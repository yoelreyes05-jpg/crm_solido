'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

export default function ClientesPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const crearCliente = async () => {
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, email }),
      })

      const data = await res.json()
      console.log(data)

      alert('Cliente creado correctamente')
      window.location.reload()

    } catch (error) {
      console.error(error)
      alert('Error al crear cliente')
    }
  }

  return (
    <div>
      <h1>Crear Cliente</h1>

      <input
        placeholder="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Teléfono"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <button onClick={crearCliente}>
        <Plus size={20} /> Guardar Cliente
      </button>
    </div>
  )
}