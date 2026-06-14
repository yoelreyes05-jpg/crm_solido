import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — listar cuadres (últimos 60)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("cuadre_caja")
      .select("*")
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(60);

    if (error) throw error;

    return NextResponse.json({ cuadres: data });
  } catch (err: any) {
    console.error("GET cuadre_caja:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — crear cuadre
export async function POST(req: Request) {
  try {
    const b = await req.json();

    const {
      fecha,
      turno,
      efectivo_sistema,
      tarjeta_sistema,
      transferencia_sistema,
      efectivo_fisico,
      tarjeta_fisica,
      transferencia_fisica,
      egresos,
      notas,
      ingresos_sistema,
      ingresos_fisico,
      diferencia,
      responsable,
    } = b;

    const { error } = await supabase.from("cuadre_caja").insert([
      {
        fecha,
        turno,
        efectivo_sistema: efectivo_sistema || 0,
        tarjeta_sistema: tarjeta_sistema || 0,
        transferencia_sistema: transferencia_sistema || 0,
        efectivo_fisico: efectivo_fisico || 0,
        tarjeta_fisica: tarjeta_fisica || 0,
        transferencia_fisica: transferencia_fisica || 0,
        egresos: egresos || 0,
        notas: notas || "",
        ingresos_sistema: ingresos_sistema || 0,
        ingresos_fisico: ingresos_fisico || 0,
        diferencia: diferencia || 0,
        responsable: responsable || "Sistema",
      },
    ]);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("POST cuadre_caja:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}