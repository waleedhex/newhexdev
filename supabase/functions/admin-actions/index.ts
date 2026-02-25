import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { admin_code, action, payload } = await req.json();

    if (!admin_code || !action) {
      return json({ error: "Missing admin_code or action" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify admin code
    const { data: codeData, error: codeError } = await supabase
      .from("subscription_codes")
      .select("code, is_admin")
      .ilike("code", admin_code.trim())
      .maybeSingle();

    if (codeError || !codeData || !codeData.is_admin) {
      return json({ error: "غير مصرح" }, 403);
    }

    // 2. Route action
    switch (action) {
      // ===== SUBSCRIPTION CODES =====
      case "codes.insert": {
        const codes: string[] = payload.codes;
        if (!codes?.length) return json({ error: "No codes" }, 400);
        const { data, error } = await supabase
          .from("subscription_codes")
          .upsert(codes.map((c: string) => ({ code: c })), { onConflict: "code", ignoreDuplicates: true })
          .select("code");
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }

      case "codes.delete": {
        const codes: string[] = payload.codes;
        if (!codes?.length) return json({ error: "No codes" }, 400);
        const PROTECTED = ["IMWRA143"];
        const safe = codes.filter((c: string) => !PROTECTED.includes(c.toUpperCase()));
        if (!safe.length) return json({ error: "All codes are protected" }, 400);
        // Batch delete in chunks of 500 to avoid query size limits
        let totalDeleted = 0;
        const BATCH = 500;
        for (let i = 0; i < safe.length; i += BATCH) {
          const batch = safe.slice(i, i + BATCH);
          const { error } = await supabase
            .from("subscription_codes")
            .delete()
            .in("code", batch);
          if (!error) totalDeleted += batch.length;
        }
        return json({ deleted: totalDeleted });
      }

      case "codes.list": {
        // Paginated fetch to bypass 1000-row limit
        let allCodes: { code: string }[] = [];
        let from = 0;
        const PAGE = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("subscription_codes")
            .select("code")
            .order("created_at", { ascending: false })
            .range(from, from + PAGE - 1);
          if (error) return json({ error: error.message }, 500);
          if (!data || data.length === 0) break;
          allCodes = allCodes.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return json({ data: allCodes });
      }

      case "codes.delete_today": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayCodes, error: fetchErr } = await supabase
          .from("subscription_codes")
          .select("code")
          .gte("created_at", today.toISOString());
        if (fetchErr) return json({ error: fetchErr.message }, 500);
        const PROTECTED = ["IMWRA143"];
        const safe = (todayCodes || []).map(c => c.code).filter(c => !PROTECTED.includes(c.toUpperCase()));
        if (!safe.length) return json({ deleted: 0 });
        const { error } = await supabase.from("subscription_codes").delete().in("code", safe);
        if (error) return json({ error: error.message }, 500);
        return json({ deleted: safe.length });
      }

      case "codes.count": {
        const { count, error } = await supabase
          .from("subscription_codes")
          .select("*", { count: "exact", head: true });
        if (error) return json({ error: error.message }, 500);
        return json({ count: count || 0 });
      }

      // ===== GENERAL QUESTIONS =====
      case "questions.insert": {
        const { letter, question, answer } = payload;
        if (!letter || !question || !answer) return json({ error: "Missing fields" }, 400);
        const { error } = await supabase.from("general_questions").insert({ letter, question, answer });
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      case "questions.bulk_insert": {
        const items: { letter: string; question: string; answer: string; lang?: string }[] = payload.items;
        if (!items?.length) return json({ error: "No items" }, 400);
        // Batch insert in chunks of 500
        let added = 0;
        const BATCH = 500;
        for (let i = 0; i < items.length; i += BATCH) {
          const batch = items.slice(i, i + BATCH).map(item => ({
            letter: item.letter,
            question: item.question,
            answer: item.answer,
            ...(item.lang ? { lang: item.lang } : {}),
          }));
          const { data, error } = await supabase.from("general_questions").insert(batch).select("id");
          if (!error && data) added += data.length;
        }
        return json({ added });
      }

      case "questions.delete": {
        const ids: number[] = payload.ids;
        if (!ids?.length) return json({ error: "No ids" }, 400);
        const { error } = await supabase.from("general_questions").delete().in("id", ids);
        if (error) return json({ error: error.message }, 500);
        return json({ deleted: ids.length });
      }

      case "questions.list": {
        const { data, error } = await supabase
          .from("general_questions")
          .select("*")
          .order("id", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }

      // ===== SESSION QUESTIONS =====
      case "session_questions.delete": {
        const ids: number[] = payload.ids;
        if (!ids?.length) return json({ error: "No ids" }, 400);
        const { error } = await supabase.from("session_questions").delete().in("id", ids);
        if (error) return json({ error: error.message }, 500);
        return json({ deleted: ids.length });
      }

      // ===== ANNOUNCEMENTS =====
      case "announcements.insert": {
        const { title, content, link, button_text } = payload;
        const { error } = await supabase.from("announcements").insert({
          title: title || null,
          content: content || null,
          link: link || null,
          button_text: button_text || null,
          is_active: true,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      case "announcements.update": {
        const { id, ...fields } = payload;
        if (!id) return json({ error: "Missing id" }, 400);
        const { error } = await supabase.from("announcements").update(fields).eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      case "announcements.delete": {
        const { id } = payload;
        if (!id) return json({ error: "Missing id" }, 400);
        const { error } = await supabase.from("announcements").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }

      case "announcements.list": {
        const { data, error } = await supabase
          .from("announcements")
          .select("*")
          .order("id", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ data });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("admin-actions error:", err);
    return json({ error: "خطأ غير متوقع" }, 500);
  }
});
