# 个人标准项目目录结构示例

这是本项目的标准目录映射。请严格参考此结构存放文件：

├── src/
│ ├── assets/ # 静态资源 (如 react.svg)
│ ├── atoms/ # 原子化全局状态 (如 search.js, user.js)
│ ├── features/ # 核心业务模块 (按业务领域划分)
│ │ ├── auth/ # 示例：权限模块
│ │ │ ├── Login.jsx # 业务组件 (大驼峰)
│ │ │ ├── Signup.jsx
│ │ │ └── useLogin.js # 业务特有 Hook (小驼峰)
│ │ └── score/
│ ├── hooks/ # 全局通用 Hooks (如 useAuth.js)
│ ├── pages/ # 页面级路由组件 (如 Home.jsx)
│ ├── services/ # 网络请求层 (统一存放，必须以 api 开头)
│ │ ├── apiAuth.js  
│ │ └── apiScore.js
│ ├── ui/ # 全局通用无状态 UI 组件
│ │ ├── AppLayout.jsx
│ │ ├── Loading.jsx
│ │ └── NavBar.jsx
│ ├── utils/ # 全局工具函数 (如 configHelper.js)
│ ├── App.jsx
│ └── main.jsx
