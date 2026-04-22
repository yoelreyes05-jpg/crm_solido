export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — reporte de costos y utilidades
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const desde = searchParams.get("desde") || "2000-01-01";
    const hasta = searchParams.get("hasta") || "2099-12-31";

    // ── 1. DETALLE POR REPUESTO ───────────────────────────────
    const { data: detalleRaw, error: err1 } = await supabase
      .from("orden_detalle")
      .select(`
        cantidad,
        precio_unitario,
        repuesto_id,
        inventario (
          id,
          nombre,
          precio_compra
        ),
        ordenes (
          fecha
        )
      `)
      .not("repuesto_id", "is", null)
      .gte("ordenes.fecha", desde)
      .lte("ordenes.fecha", hasta);

    if (err1) throw err1;

    // Agrupar manualmente (Supabase no hace GROUP BY complejo fácil)
    const mapa: any = {};

    detalleRaw.forEach((item: any) => {
      const nombre = item.inventario?.nombre || "Sin nombre";
      const precio_compra = Number(item.inventario?.precio_compra || 0);
      const cantidad = Number(item.cantidad || 0);
      const precio_venta = Number(item.precio_unitario || 0);

      if (!mapa[nombre]) {
        mapa[nombre] = {
          nombre,
          cantidad: 0,
          costo_total: 0,
          ingreso_total: 0,
        };
      }

      mapa[nombre].cantidad += cantidad;
      mapa[nombre].costo_total += cantidad * precio_compra;
      mapa[nombre].ingreso_total += cantidad * precio_venta;
    });

    const detalle = Object.values(mapa).map((r: any) => ({
      ...r,
      utilidad: r.ingreso_total - r.costo_total,
    }));

    // ── 2. RESUMEN GLOBAL ────────────────────────────────────
    const ingresos_totales = detalle.reduce(
      (s: number, r: any) => s + r.ingreso_total,
      0
    );

    const costo_repuestos = detalle.reduce(
      (s: number, r: any) => s + r.costo_total,
      0
    );

    const utilidad_bruta = ingresos_totales - costo_repuestos;

    const margen_promedio =
      ingresos_totales > 0
        ? (utilidad_bruta / ingresos_totales) * 100
        : 0;

    // ── 3. POR ORDEN ─────────────────────────────────────────
    const { data: ordenesRaw, error: err2 } = await supabase
      .from("ordenes")
      .select(`
        id,
        total,
        fecha,
        vehiculos (marca, modelo, placa),
        orden_detalle (
          cantidad,
          precio_unitario,
          inventario (precio_compra)
        )
      `)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false })
      .limit(50);

    if (err2) throw err2;

    const ordenes = ordenesRaw.map((o: any) => {
      let costo = 0;

      o.orden_detalle?.forEach((d: any) => {
        const precio_compra = Number(d.inventario?.precio_compra || 0);
        costo += Number(d.cantidad || 0) * precio_compra;
      });

      return {
        id: o.id,
        vehiculo: `${o.vehiculos?.marca || ""} ${o.vehiculos?.modelo || ""} ${o.vehiculos?.placa || ""}`,
        fecha: o.fecha,
        costo_repuestos: costo,
        total_cobrado: Number(o.total || 0),
        utilidad: Number(o.total || 0) - costo,
      };
    });

    return NextResponse.json({
      ingresos_totales,
      costo_repuestos,
      utilidad_bruta,
      margen_promedio,
      detalle,
      ordenes,
    });

  } catch (err: any) {
    console.error("GET costos:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}