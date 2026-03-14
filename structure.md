nia-path-ai/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── offline.html
│   ├── icons/ (192, 512 png)
│   └── images/
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Landing / Stealth shell
│   │   ├── (stealth)/              # Stealth route group
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx            # Financial tracker UI
│   │   ├── (nia)/                  # Hidden justice app route group
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── chat/page.tsx
│   │   │   ├── evidence/page.tsx
│   │   │   ├── timeline/page.tsx
│   │   │   ├── emergency/page.tsx
│   │   │   ├── help/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── api/
│   │       ├── ai/chat/route.ts
│   │       ├── evidence/upload/route.ts
│   │       └── cases/route.ts
│   ├── features/
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── evidence/
│   │   ├── emergency/
│   │   ├── cases/
│   │   ├── help/
│   │   └── stealth/
│   ├── store/
│   │   ├── index.ts
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── casesSlice.ts
│   │   │   ├── evidenceSlice.ts
│   │   │   └── emergencySlice.ts
│   │   └── hooks.ts
│   ├── lib/
│   │   ├── supabase/
│   │   ├── queryClient.ts
│   │   └── crypto.ts
│   ├── hooks/
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   ├── types/
│   └── utils/
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
