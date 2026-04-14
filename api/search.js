export default async function handler(req, res) {
  // CORS設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // パスワード照合（環境変数から取得）
  const { password, helper, user } = req.query;

  if (password !== process.env.SEARCH_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // GASにリクエストを転送
  const gasUrl = process.env.GAS_URL;
  const params = new URLSearchParams();
  if (helper) params.append('helper', helper);
  if (user)   params.append('user',   user);

  try {
    const gasRes  = await fetch(`${gasUrl}?${params.toString()}`);
    const data    = await gasRes.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'GAS request failed', detail: e.message });
  }
}
