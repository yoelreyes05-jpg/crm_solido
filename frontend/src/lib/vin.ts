/**
 * Decodificador VIN — llama directamente a NHTSA desde el navegador.
 * NHTSA es pública, gratuita y permite CORS.
 * No depende del backend para decodificar.
 */

export interface VINData {
  vin:         string;
  marca:       string | null;
  modelo:      string | null;
  ano:         string | null;
  motor:       string | null;
  combustible: string | null;
  pais:        string | null;
  tipo_vehiculo: string | null;
}

function parsearResultados(results: any[]): Omit<VINData, "vin"> {
  const get = (label: string) =>
    results.find((r: any) => r.Variable === label)?.Value?.trim() || null;

  const marca      = get("Make");
  const modeloBase = get("Model");
  const trim       = get("Trim");
  const modelo     = modeloBase && trim ? `${modeloBase} ${trim}` : (modeloBase || null);
  const ano        = get("Model Year");
  const motorL     = get("Displacement (L)");
  const motorCC    = get("Displacement (CC)");
  const cilindros  = get("Engine Number of Cylinders");
  const config     = get("Engine Configuration");
  const combustible = get("Fuel Type - Primary");
  const pais       = get("Plant Country");
  const tipo       = get("Vehicle Type");

  // Normalizar config: "V-Shaped" → "V6", "In-Line" → "L4"
  let configStr: string | null = null;
  if (config && cilindros) {
    if (config.toLowerCase().includes("v"))    configStr = `V${cilindros}`;
    else if (config.toLowerCase().includes("line")) configStr = `L${cilindros}`;
    else configStr = config;
  }

  let motorStr: string | null = null;
  if (motorL) {
    motorStr = `${parseFloat(motorL).toFixed(1)}L`;
    if (configStr) motorStr += ` ${configStr}`;
    else if (cilindros) motorStr += ` (${cilindros} cil.)`;
  } else if (motorCC) {
    motorStr = `${motorCC}cc`;
    if (configStr) motorStr += ` ${configStr}`;
  }

  const fuelMap: Record<string, string> = {
    "Gasoline":                       "Gasolina",
    "Diesel":                         "Diesel",
    "Electric":                       "Eléctrico",
    "Flexible Fuel Vehicle (FFV)":    "Flex (Gas/Etanol)",
    "Hybrid":                         "Híbrido",
    "Plug-in Hybrid":                 "Híbrido Enchufable",
    "Compressed Natural Gas (CNG)":   "Gas Natural",
  };
  const combustibleStr = (combustible && fuelMap[combustible]) || combustible || null;

  return { marca, modelo, ano, motor: motorStr, combustible: combustibleStr, pais, tipo_vehiculo: tipo };
}

/**
 * Decodifica un VIN de 17 caracteres usando la API pública de NHTSA.
 * Lanza un error si el VIN es inválido o NHTSA no lo reconoce.
 */
export async function decodificarVIN(vin: string): Promise<VINData> {
  const v = vin.trim().toUpperCase();
  if (v.length !== 17) throw new Error("El VIN debe tener exactamente 17 caracteres");

  const res = await fetch(
    `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${encodeURIComponent(v)}?format=json`
  );
  if (!res.ok) throw new Error("Error al consultar NHTSA");

  const body = await res.json();
  const results: any[] = body?.Results || [];
  const parsed = parsearResultados(results);

  if (!parsed.marca) throw new Error("VIN no reconocido por NHTSA");

  return { vin: v, ...parsed };
}
