import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL || "https://iyguvcqubcnqcyfosbmp.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Z3V2Y3F1YmNucWN5Zm9zYm1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY4MTM4MCwiZXhwIjoyMDg3MjU3MzgwfQ.5IJwZ3a97IP0QxRTtfxG5bdRuOZjSuac6-iL3P7gniY";
const supabase = createClient(supabaseUrl, supabaseKey);

const db = new Database("church.db");

// Initialize Local Database (for fallback or local settings if needed, but we prefer Supabase)
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    cpf TEXT UNIQUE,
    photo TEXT,
    role_media INTEGER DEFAULT 0,
    role_council INTEGER DEFAULT 0,
    role_board INTEGER DEFAULT 0,
    role_deacon INTEGER DEFAULT 0,
    board_position TEXT,
    is_admin INTEGER DEFAULT 0,
    password TEXT
  );
  -- ... other tables omitted for brevity in local DB initialization if we use Supabase
`);

// Seed owner account locally just in case, but we should also check Supabase
const seedOwner = async () => {
  const { data: owner, error } = await supabase
    .from("members")
    .select("*")
    .eq("cpf", "04149195994")
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error("Erro ao verificar proprietário no Supabase:", error.message);
    return;
  }

  if (!owner) {
    const { error: insertError } = await supabase.from("members").insert([
      { 
        name: "Jonathan Costa Rodrigues", 
        email: "jntcrodrigues@gmail.com", 
        cpf: "04149195994", 
        is_admin: 1, 
        password: "Up13121637$",
        role_media: 1,
        role_council: 1,
        role_board: 1,
        role_deacon: 1,
        board_position: "Proprietário"
      }
    ]);
    if (insertError) {
      console.error("Erro ao criar proprietário no Supabase:", insertError.message);
    }
  }
};

const seedSettings = async () => {
  const settingsToSeed = [
    { 
      key: "mission", 
      value: "Adorar a deus, anunciando a salvação através de Cristo Jesus, em uma nova vida de regeneração e conversão genuína, pela ação do Espirito Santo, conhecendo a Deus e fazendo-o conhecido. Este processo inicia no indivíduo, transborda na família, igreja e na sociedade." 
    },
    { 
      key: "vision", 
      value: "Trazer pessoas a Jesus pelo evangelho, solidifica-las na maturidade cristã e equipá-las como igreja, para uma vida organizada de adoração, assistência mútua e expansão do Reino de Deus." 
    },
    { 
      key: "culture", 
      value: "Uma igreja que vive o Reino de Deus; uma família que acolhe, ama, cuida, capacita, inspira e envia filhos para o seu propósito. Uma igreja relevante na sociedade que está inserida, adorando a Deus, servindo à comunidade" 
    }
  ];

  for (const setting of settingsToSeed) {
    const { data } = await supabase.from("settings").select("*").eq("key", setting.key).single();
    if (!data) {
      await supabase.from("settings").insert([setting]);
    }
  }
};

seedOwner();
seedSettings();

async function startServer() {
  // API Routes using Supabase
  app.post("/api/login", async (req, res) => {
    const { email, password } = req.body;
    
    const { data: user, error } = await supabase
      .from("members")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .single();

    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  });

  app.get("/api/members", async (req, res) => {
    const { data: members } = await supabase.from("members").select("*");
    res.json(members || []);
  });

  app.post("/api/members", async (req, res) => {
    const { name, email, cpf, photo, role_media, role_council, role_board, role_deacon, board_position, is_admin, password } = req.body;
    const { error } = await supabase.from("members").insert([
      { 
        name, 
        email, 
        cpf, 
        photo, 
        role_media: role_media ? 1 : 0, 
        role_council: role_council ? 1 : 0, 
        role_board: role_board ? 1 : 0, 
        role_deacon: role_deacon ? 1 : 0,
        board_position, 
        is_admin: is_admin ? 1 : 0,
        password: password || cpf // Default password to CPF if not provided
      }
    ]);
    
    if (error) {
      res.status(400).json({ error: "Erro ao cadastrar membro: " + error.message });
    } else {
      res.json({ success: true });
    }
  });

  app.get("/api/word-of-day", async (req, res) => {
    const { data: word } = await supabase
      .from("word_of_day")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    
    res.json(word || { author: "Sistema", message: "Nenhuma reflexão hoje.", date: new Date().toLocaleDateString() });
  });

  app.post("/api/word-of-day", async (req, res) => {
    const { author, message, date } = req.body;
    await supabase.from("word_of_day").insert([{ author, message, date }]);
    res.json({ success: true });
  });

  app.get("/api/live-worship", async (req, res) => {
    const { data: live } = await supabase
      .from("live_worship")
      .select("*")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    res.json(live || { url: "" });
  });

  app.post("/api/live-worship", async (req, res) => {
    const { url } = req.body;
    await supabase.from("live_worship").insert([{ url }]);
    res.json({ success: true });
  });

  app.get("/api/prayer-requests", async (req, res) => {
    const { data: prayers } = await supabase
      .from("prayer_requests")
      .select("*")
      .order("created_at", { ascending: false });
    res.json(prayers || []);
  });

  app.post("/api/prayer-requests", async (req, res) => {
    const { name, request } = req.body;
    await supabase.from("prayer_requests").insert([{ name, request }]);
    res.json({ success: true });
  });

  app.get("/api/schedules", async (req, res) => {
    const { data: schedules } = await supabase.from("schedules").select("*");
    res.json(schedules || []);
  });

  app.post("/api/schedules", async (req, res) => {
    const { day, time, description } = req.body;
    await supabase.from("schedules").insert([{ day, time, description }]);
    res.json({ success: true });
  });

  app.get("/api/scale", async (req, res) => {
    const { data: scale } = await supabase
      .from("scale")
      .select("*")
      .order("date", { ascending: false });
    res.json(scale || []);
  });

  app.post("/api/scale", async (req, res) => {
    const { date, day_of_week, opening, contributions, avisos, final_prayer } = req.body;
    await supabase.from("scale").insert([{ date, day_of_week, opening, contributions, avisos, final_prayer }]);
    res.json({ success: true });
  });

  app.get("/api/events", async (req, res) => {
    const { data: events } = await supabase.from("events").select("*");
    res.json(events || []);
  });

  app.post("/api/events", async (req, res) => {
    const { title, image, date } = req.body;
    await supabase.from("events").insert([{ title, image, date }]);
    res.json({ success: true });
  });

  app.get("/api/visitors", async (req, res) => {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    
    // Cleanup: Delete visitors older than 48 hours
    await supabase.from("visitors").delete().lt("created_at", fortyEightHoursAgo);

    const { data: visitors } = await supabase
      .from("visitors")
      .select("*")
      .order("created_at", { ascending: false });
    
    res.json(visitors || []);
  });

  app.post("/api/visitors", async (req, res) => {
    const { name, address, phone, whatsapp, is_christian, previous_church } = req.body;
    await supabase.from("visitors").insert([
      { name, address, phone, whatsapp, is_christian: is_christian ? 1 : 0, previous_church }
    ]);
    res.json({ success: true });
  });

  app.get("/api/settings", async (req, res) => {
    const { data: settings } = await supabase.from("settings").select("*");
    const settingsObj = (settings || []).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(settingsObj);
  });

  app.post("/api/settings", async (req, res) => {
    const { key, value } = req.body;
    await supabase.from("settings").upsert({ key, value });
    res.json({ success: true });
  });

  // Daily Reports API
  app.get("/api/daily-reports", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Cleanup: Delete reports older than today
    await supabase.from("daily_reports").delete().lt("date", today);

    const { data: reports } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("date", today);
    
    res.json(reports || []);
  });

  app.post("/api/daily-reports", async (req, res) => {
    const { offerings, tithes, expenses, total, approver_id, created_by_id, created_by_name } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const dayOfWeek = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date());

    const { data, error } = await supabase.from("daily_reports").insert([
      {
        date: today,
        day_of_week: dayOfWeek,
        offerings,
        tithes,
        expenses,
        total,
        approver_id,
        created_by_id,
        created_by_name,
        status: "pending"
      }
    ]).select();

    if (error) return res.status(400).json({ error: error.message });
    res.json(data[0]);
  });

  app.post("/api/daily-reports/:id/authorize", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from("daily_reports")
      .update({ status: "authorized" })
      .eq("id", id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/courses", async (req, res) => {
    const { data: courses } = await supabase.from("courses").select("*");
    res.json(courses || []);
  });

  app.post("/api/courses", async (req, res) => {
    const { title, description, image } = req.body;
    await supabase.from("courses").insert([{ title, description, image }]);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
