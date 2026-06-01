import { getSupabaseAdmin } from "../utils/supabase.js";
import { getRelatedSkills } from "../utils/skillGraph.js";

// 📚 Calculate compatibility score purely for textual reasons now
const calculateCompatibilityScore = (currentUser, otherUser) => {
  let score = 0;
  const reasons = [];

  const currentSkills = currentUser.skills || [];
  const otherSkills = otherUser.skills || [];
  const currentInterests = currentUser.interests || [];
  const otherInterests = otherUser.interests || [];
  const currentTeach = currentUser.teach_subjects || [];
  const otherTeach = otherUser.teach_subjects || [];
  const currentLearn = currentUser.learn_subjects || [];
  const otherLearn = otherUser.learn_subjects || [];

  const commonSkills = currentSkills.filter((skill) => otherSkills.includes(skill));
  if (commonSkills.length > 0) {
    score += commonSkills.length * 10;
    reasons.push(`You both share ${commonSkills.slice(0, 2).join(", ")} skills.`);
  }

  let relatedSkillMatches = [];
  currentSkills.forEach((skill) => {
    const relatedSkills = getRelatedSkills(skill) || [];
    relatedSkills.forEach((relatedSkill) => {
      if (otherSkills.includes(relatedSkill) && !commonSkills.includes(relatedSkill)) {
        relatedSkillMatches.push(relatedSkill);
      }
    });
  });
  relatedSkillMatches = [...new Set(relatedSkillMatches)];
  if (relatedSkillMatches.length > 0) {
    score += relatedSkillMatches.length * 6;
    reasons.push(`Related technologies include ${relatedSkillMatches.slice(0, 2).join(", ")}.`);
  }

  const commonInterests = currentInterests.filter((interest) => otherInterests.includes(interest));
  if (commonInterests.length > 0) {
    score += commonInterests.length * 3;
    reasons.push(`Shared interests in ${commonInterests.slice(0, 2).join(", ")}.`);
  }

  const currentTeachesOtherLearns = currentTeach.filter((subject) => otherLearn.includes(subject));
  if (currentTeachesOtherLearns.length > 0) {
    score += currentTeachesOtherLearns.length * 8;
    reasons.push(`You can teach them ${currentTeachesOtherLearns.slice(0, 2).join(", ")}.`);
  }

  const currentLearnsOtherTeaches = currentLearn.filter((subject) => otherTeach.includes(subject));
  if (currentLearnsOtherTeaches.length > 0) {
    score += currentLearnsOtherTeaches.length * 8;
    reasons.push(`They can teach you ${currentLearnsOtherTeaches.slice(0, 2).join(", ")}.`);
  }

  return {
    compatibilityScore: Math.min(score, 100),
    reasons,
  };
};

const PAGE_SIZE = 20;

export const getRecommendedPartners = async (req, res) => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: "Supabase client not configured" });
    }

    const currentUserEmail = req.user.email;
    
    // Fetch current user from Supabase profiles
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('profiles')
      .select('skills, interests, teach_subjects, learn_subjects')
      .eq('email', currentUserEmail)
      .single();

    if (currentUserError || !currentUser) {
      return res.status(404).json({ success: false, message: "User profile not found" });
    }

    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || PAGE_SIZE));
    const skip = (page - 1) * limit;

    // Calculate related skills
    const currentSkills = currentUser.skills || [];
    let allRelatedSkills = [];
    currentSkills.forEach((skill) => {
      const related = getRelatedSkills(skill) || [];
      allRelatedSkills.push(...related);
    });
    allRelatedSkills = [...new Set(allRelatedSkills)];

    // Fetch matching users natively via Supabase RPC (O(N) executed in C++ Postgres core, paginated)
    const { data: matchedUsers, error: usersError } = await supabaseAdmin.rpc('match_users', {
      target_email: currentUserEmail,
      target_skills: currentSkills,
      target_related_skills: allRelatedSkills,
      target_interests: currentUser.interests || [],
      target_teach: currentUser.teach_subjects || [],
      target_learn: currentUser.learn_subjects || [],
      page_limit: limit,
      page_offset: skip
    });

    if (usersError) {
       console.error("Supabase RPC match_users error:", usersError);
       return res.status(500).json({ success: false, message: "Database Error" });
    }

    // Now format the 20 returned users with reasons
    const recommendations = (matchedUsers || []).map((user) => {
      // We pass through calculateCompatibilityScore ONLY to get the rich reason string
      // The score is already calculated perfectly by the database.
      const result = calculateCompatibilityScore(currentUser, user);
      return {
        _id: user.id,
        name: user.name,
        skills: user.skills || [],
        interests: user.interests || [],
        teach_subjects: user.teach_subjects || [],
        learn_subjects: user.learn_subjects || [],
        compatibilityScore: user.compatibility_score, // Trust the database score
        reason: result.reasons[0] || "You have similar learning interests and compatible skills.",
      };
    });

    // In a real paginated RPC, getting exact total Count requires a separate count query. 
    // We'll estimate or just provide length for now since counting 1M rows can also be slow.
    res.status(200).json({
      success: true,
      count: recommendations.length,
      total: recommendations.length > 0 ? skip + limit + 1 : skip, // Rough pagination cursor hack
      page,
      totalPages: recommendations.length === limit ? page + 1 : page,
      recommendations,
    });
  } catch (error) {
    console.error("Recommendation Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};