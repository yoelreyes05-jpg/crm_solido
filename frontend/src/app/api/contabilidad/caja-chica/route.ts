import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — listar movimientos + fondo actual
export async function GET() {
  try {
    const { data: movimientos, error: err1 } = await supabase
      .from("caja_chica")
      .select("*")
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(100);

    if (err1) throw err1;

    const { data: config, error: err2 } = await supabase
      .from("contabilidad_config")
      .select("valor")
      .eq("clave", "fondo_caja_chica")
      .single();

    if (err2 && err2.code !== "PGRST116") throw err2;

    const fondo_actual = config?.valor || 5000;

    return NextResponse.json({
      movimientos,
      fondo_actual: Number(fondo_actual),
    });
  } catch (err: any) {
    console.error("GET caja_chica:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — registrar movimiento
export async function POST(req: Request) {
  try {
    const { tipo, monto, categoria, descripcion, fecha, usuario } =
      await req.json();

    const { error } = await supabase.from("caja_chica").insert([
      {
        tipo,
        monto,
        categoria: categoria || "Otro",
        descripcion: descripcion || "",
        fecha,
        usuario: usuario || "Sistema",
      },
    ]);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST caja_chica:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — actualizar fondo inicial
export async function PATCH(req: Request) {
  try {
    const { fondo_inicial } = await req.json();

    const { error } = await supabase.from("contabilidad_config").upsert(
      {
        clave: "fondo_caja_chica",
        valor: String(fondo_inicial),
      },
      { onConflict: "clave" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("PATCH caja_chica:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}