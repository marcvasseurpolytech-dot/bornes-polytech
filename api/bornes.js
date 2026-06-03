const GIST_ID = "7c68734989e5d53c30ceebf6bb1a314d";
const TOKEN = process.env.GITHUB_TOKEN;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const headers = {
    "Authorization": `token ${TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "Content-Type": "application/json",
  };

  if (req.method === "GET") {
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, { headers });
    if (!r.ok) return res.status(500).json({ error: "gist read failed" });
    const data = await r.json();
    const content = JSON.parse(data.files["bornes.json"].content);
    return res.status(200).json(content);
  }

  if (req.method === "PATCH") {
    const state = req.body;
    const r = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ files: { "bornes.json": { content: JSON.stringify(state) } } }),
    });
    if (!r.ok) return res.status(500).json({ error: "gist write failed" });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}
