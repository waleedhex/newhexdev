export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://zswtcjxmvwgbcbgwvatu.supabase.co/functions/v1/cleanup-stale-sessions",
      {
        method: "POST"
      }
    );

    const data = await response.json();

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Cleanup failed"
    });
  }
}
