'use client';

import { useEffect, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable
} from '@hello-pangea/dnd';

const API = process.env.NEXT_PUBLIC_API_URL!;



interface Order {
  id: number;
  descripcion: string;
  estado: string;
  cliente_nombre: string;
  vehiculo_info: string;
}

const COLUMNS = [
  "RECIBIDO",
  "DIAGNOSTICO",
  "REPARACION",
  "CONTROL_CALIDAD",
  "LISTO",
  "ENTREGADO"
];

export default function Kanban() {
  const [orders, setOrders] = useState<Order[]>([]);

  const loadData = async () => {
    const res = await fetch(`${API}/ordenes`);
    const data = await res.json();
    setOrders(data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateStatus = async (id: number, estado: string) => {
    await fetch(`${API}/ordenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado })
    });
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const orderId = Number(result.draggableId);
    const newStatus = result.destination.droppableId;

    await updateStatus(orderId, newStatus);
    loadData(); // refresca
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>🧠 Tablero de Trabajo (Kanban)</h1>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>

          {COLUMNS.map((col) => (
            <Droppable droppableId={col} key={col}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    minWidth: 250,
                    background: '#f4f4f4',
                    padding: 10,
                    borderRadius: 10
                  }}
                >
                  <h3>{col}</h3>

                  {orders
                    .filter(o => o.estado === col)
                    .map((o, index) => (
                      <Draggable
                        draggableId={String(o.id)}
                        index={index}
                        key={o.id}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              background: 'white',
                              padding: 10,
                              marginBottom: 10,
                              borderRadius: 8,
                              boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                              ...provided.draggableProps.style
                            }}
                          >
                            <strong>#{o.id}</strong>
                            <p>{o.cliente_nombre}</p>
                            <p>{o.vehiculo_info}</p>
                            <small>{o.descripcion}</small>
                          </div>
                        )}
                      </Draggable>
                    ))}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}

        </div>
      </DragDropContext>
    </div>
  );
}