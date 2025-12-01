# Supabase Client Utilities

This directory contains Supabase client utilities for different use cases in your Next.js application.

## Usage

### Client Components (Browser)
```typescript
'use client'
import { createClient } from '@/lib/supabase/client'

export default function MyClientComponent() {
  const supabase = createClient()
  
  // Use for client-side operations
  const { data } = await supabase.from('users').select()
}
```

### Server Components (RSC)
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function MyServerComponent() {
  const supabase = await createClient()
  
  // Automatically reads session from cookies
  const { data: { user } } = await supabase.auth.getUser()
  
  // Fetch data
  const { data } = await supabase.from('users').select()
  
  return <div>...</div>
}
```

### API Routes
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select()
  return NextResponse.json(data)
}
```

## Authentication Flow

1. User signs in via `/auth` page
2. Middleware (`middleware.ts`) protects all routes except `/auth`
3. Server/client components can access the authenticated user via `supabase.auth.getUser()`

