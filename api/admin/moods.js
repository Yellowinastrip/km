const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_API_TOKEN",
  "SUPABASE_KATYA_USER_ID",
  "SUPABASE_MYKYTA_USER_ID",
];

const USER_IDS_BY_PERSON = {
  katya: "SUPABASE_KATYA_USER_ID",
  mykyta: "SUPABASE_MYKYTA_USER_ID",
};

module.exports = async function handler(request, response) {
  if (!hasRequiredEnv()) {
    return response.status(500).json({ error: "Admin API is not configured" });
  }

  if (!isAuthorized(request)) {
    return response.status(401).json({ error: "Unauthorized" });
  }

  if (request.method === "GET") {
    return listMoods(response);
  }

  if (request.method === "POST") {
    return createMood(request, response);
  }

  if (request.method === "DELETE") {
    return deleteMood(request, response);
  }

  response.setHeader("Allow", "GET, POST, DELETE");
  return response.status(405).json({ error: "Method not allowed" });
};

function hasRequiredEnv() {
  return REQUIRED_ENV.every((name) => Boolean(process.env[name]));
}

function isAuthorized(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : request.headers["x-admin-token"];
  return token && token === process.env.ADMIN_API_TOKEN;
}

async function listMoods(response) {
  const result = await supabaseFetch("/rest/v1/mood_entries?select=*&order=created_at.desc", {
    method: "GET",
  });

  return sendSupabaseResult(response, result, 200);
}

async function createMood(request, response) {
  const body = request.body || {};
  const person = body.person;
  const userIdEnv = USER_IDS_BY_PERSON[person];
  const userId = userIdEnv ? process.env[userIdEnv] : null;

  if (!userId) {
    return response.status(400).json({ error: "person must be katya or mykyta" });
  }

  const requiredFields = ["categoryId", "categoryTitle", "mood", "emoji"];
  const missing = requiredFields.filter((field) => !body[field]);
  if (missing.length) {
    return response.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }

  const payload = {
    user_id: userId,
    person,
    category_id: body.categoryId,
    category_title: body.categoryTitle,
    mood: body.mood,
    emoji: body.emoji,
  };

  if (body.createdAt) {
    payload.created_at = body.createdAt;
  }

  const result = await supabaseFetch("/rest/v1/mood_entries", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  return sendSupabaseResult(response, result, 201);
}

async function deleteMood(request, response) {
  const id = request.query?.id;
  if (!id) {
    return response.status(400).json({ error: "id query parameter is required" });
  }

  const result = await supabaseFetch(`/rest/v1/mood_entries?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Prefer: "return=representation" },
  });

  return sendSupabaseResult(response, result, 200);
}

async function supabaseFetch(path, options) {
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

function sendSupabaseResult(response, result, successStatus) {
  if (!result.ok) {
    return response.status(result.status).json(result.body || { error: "Supabase request failed" });
  }

  return response.status(successStatus).json(result.body);
}
