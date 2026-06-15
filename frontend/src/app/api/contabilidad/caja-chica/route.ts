import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET - listar movimientos + fondo actual
export async function GET() {
  try {
    // Nota: la tabla caja_chica no tiene columna creado_en; ordenamos por fecha y luego id.
    const { data: movimientos, error: err1 } = await supabase
      .from("caja_chica")
      .select("*")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
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

// POST - registrar movimiento
export async function POST(req: Request) {
  try {
    const { tipo, monto, descripcion, fecha, usuario } = await req.json();

    // La tabla caja_chica no tiene columna categoria; la categoria ya viene
    // incluida dentro de descripcion (ej: [Limpieza] compra detergente).
    // Guardamos el instante completo si no se envia fecha, para conservar la hora.
    const { error } = await supabase.from("caja_chica").insert([
      {
        tipo,
        monto,
        descripcion: descripcion || "",
        fecha: fecha || new Date().toISOString(),
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

// PATCH - actualizar fondo inicial
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
