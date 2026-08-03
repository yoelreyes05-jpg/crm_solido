# 📥 Carpeta para subir información

Deja aquí cualquier archivo que quieras que yo lea o cargue al sistema, en vez
de pegarlo en el chat. Yo tengo acceso a esta carpeta directamente.

Después de dejar el archivo, solo escríbeme algo como:
**"ya subí el archivo de suplidores a datos-importar, cárgalo"**.

---

## Formatos que puedo leer

| Formato | Extensión | Qué tan bien lo leo |
|---|---|---|
| **CSV** | `.csv` | ✅ **El mejor.** Úsalo siempre que sea una tabla. |
| Excel | `.xlsx`, `.xls` | ✅ Bien. Si tiene varias hojas, dime cuál. |
| Texto / Markdown | `.txt`, `.md` | ✅ Bien. |
| JSON | `.json` | ✅ Bien. |
| Word | `.docx` | ✅ Bien. |
| PDF | `.pdf` | ⚠️ Bien si es texto. Si es un escaneo o foto, puede fallar. |
| Fotos de documentos | `.jpg`, `.png` | ⚠️ Puedo verlas, pero transcribir a mano da errores. Prefiere CSV. |

**Recomendación:** si vas a mandar precios, listados o inventario, exporta a
**CSV** desde Excel (Archivo → Guardar como → CSV UTF-8). Es el formato que
menos errores da al cargar a la base de datos.

---

## Reglas para que un CSV cargue sin problemas

1. **La primera fila son los nombres de columna**, sin espacios raros.
2. **Si un campo tiene coma, va entre comillas dobles:**
   `"Prueba de carga: bateria, alternador y arranque"`
3. **Los precios sin símbolo ni separador de miles:** `10450`, no `RD$ 10,450.00`
4. **Guarda como UTF-8** para que los acentos y la ñ no salgan rotos.
5. **Una fila por registro.** Nada de celdas combinadas ni títulos encima de la tabla.

---

## Archivos que ya viven aquí

### `tarifario_mano_obra.csv`
El tarifario de mano de obra del taller. Este mismo archivo se puede volver a
subir desde la pantalla **Tarifario** del CRM para actualizar precios en masa:
se busca cada renglón por su `codigo` y se actualiza; los códigos nuevos se
crean. Nada se borra.

**Columnas:**

| Columna | Qué es |
|---|---|
| `codigo` | Identificador único, ej. `MO-F01`. Es la llave: no lo cambies. |
| `nombre` | Descripción de la operación tal como sale en la factura |
| `categoria` | FRENOS, MOTOR Y ENCENDIDO, ELECTRICO... |
| `tipo` | SERVICIO |
| `unidad` | UND |
| `horas_estandar` | Tiempo de referencia del trabajo, ej. `1.5` |
| `precio_seg_a_sedan` | Precio para sedán 4 cilindros |
| `precio_seg_b_suv` | Precio para SUV / crossover |
| `precio_seg_c_v6_camioneta` | Precio para V6 y camionetas |
| `precio_seg_d_diesel_europeo` | Precio para diésel y marcas europeas |
| `itbis` | Porcentaje de ITBIS, normalmente `18` |
| `notas` | Aclaraciones internas (no salen en la factura) |

**Para subir precios nuevos:** abre el CSV en Excel, cambia los precios,
guarda como CSV UTF-8, y súbelo desde **Tarifario → 📥 Importar CSV**.

---

## Otras cosas que me puedes dejar aquí

- Listas de precios de suplidores
- Inventario para cargar en masa
- Catálogos de repuestos con códigos
- Tablas de aceites y filtros por modelo
- Cualquier documento del taller que quieras que revise

Si el archivo tiene un formato distinto al que espera el sistema, dímelo y yo
escribo la conversión — no hace falta que lo arregles a mano.
