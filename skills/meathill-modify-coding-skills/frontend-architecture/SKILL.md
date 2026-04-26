---
name: frontend-architecture
description: >
  前端目录架构、组件隔离与文件命名规范。
  当用户要求“初始化前端项目”、“创建新页面”、“写一个新组件”、“处理网络请求”、
  “封装 UI 组件”，或者提到“按规范放置文件”时，强制触发并严格遵守此规范。
---

# Frontend Architecture & Naming Conventions

You are strictly following a customized, pragmatic frontend architecture.

Please read `references/folder-tree-example.md` before creating new project structures.

## 1. Root Directory Structure

The `src/` directory MUST be organized into these specific folders:

- `features/`: For domain-specific business logic and components. Grouped by feature name (e.g., `auth`, `student`).
- `ui/`: ONLY for globally shared, presentation-only UI components (e.g., `NavBar`, `Loading`, `Pagination`).
- `services/`: **(CRITICAL)** All network/API request logic MUST be centralized here. Do not place API calls inside `features/`.
- `pages/`: Route-level components. They should primarily assemble `features` and `ui`.
- `atoms/`: For global state atoms (if using Jotai/Recoil).
- `hooks/`: For globally shared React hooks.
- `utils/`: For pure JavaScript helper functions.

## 2. Component Isolation (UI vs Features)

When creating components, place them correctly based on their role:

- **Presentation UI (`src/ui/`)**: Components that only render props and manage local UI state (no complex business logic, no direct API calls).
- **Business Components (`src/features/<name>/`)**: Components tied to specific business logic. They can use local hooks (e.g., `useLogin.js`) to interact with the `services/` layer.

## 3. Strict Naming Conventions

**[CRITICAL OVERRIDE]: The following naming rules SUPERSEDE AND OVERRIDE any default naming conventions defined in the global `copilot-instructions` or `DEV_NOTE.md`.**

You MUST adhere to the following naming rules. This project differentiates naming based on file type:

### ① React Components (.jsx / .tsx)

- MUST use **PascalCase** (大驼峰).
- ✅ GOOD: `Login.jsx`, `AppLayout.jsx`, `ErrorMessage.jsx`
- ❌ BAD: `login.jsx`, `app-layout.jsx`

### ② Logic Files, Utilities, and State (.js / .ts)

- MUST use **camelCase** (小驼峰).
- ✅ GOOD: `useLogin.js`, `configHelper.js`, `user.js`
- ❌ BAD: `use-login.js`, `UserHelper.js`

### ③ API Services (`src/services/`)

- Files containing network requests MUST be placed in `src/services/` and use **camelCase starting with `api`**.
- ✅ GOOD: `apiAuth.js`, `apiTeacher.js`, `apiScore.js`
- Functions inside these files should also clearly indicate their action (e.g., `export const login = ...` inside `apiAuth.js`).

## 4. Red Flags (DO NOT DO THIS)

- **DO NOT** put API fetch functions inside `features/` or `ui/`. They belong in `services/`.
- **DO NOT** use kebab-case (e.g., `my-component.jsx`) for filenames. Stick to PascalCase for components and camelCase for logic.
