
# AL Interface Tracker

![VS Code](https://img.shields.io/badge/VISUAL%20STUDIO%20CODE-AL%20Extension-blue?logo=visualstudiocode&logoColor=white)
![Language](https://img.shields.io/badge/language-AL-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green)

> 🧠 Track and visualize interface definitions and implementations in AL projects for Microsoft Dynamics 365 Business Central.

---

## 🚀 Getting Started

1. Install the extension from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/).
2. Open a Business Central AL project in VS Code.
3. Check the **"AL Interface Tracker"** view on the side panel.
4. Use **"Collapse All"** action to collapse the tree view.
5. Use **"Manual Refresh"** action to update the view.

---

## 📂 Tree Structure

```
AL Interface Tracker
└── Interfaces
    ├── ICustomerHandler
    │   ├── App1
    │   │   ├─ MyHandler (codeunit)
    │   └── App2
    │       └─ ExtendedHandler (enum)
    └── IEmailService
        └── App1
            └─ EmailDispatcher (codeunit)
```
---

## ✨ Features

- 🔍 Detects and displays **interface definitions** across your AL workspace.
- 🧭 Lists all **implementations grouped by workspace folder**.
- 👁️ Quickly **open interface definitions** via right-click context menu.
- 🧩 Recognizes **quoted** and **multiline interface**.
- 🧰 Convenient commands to **refresh** and **collapse** the tree.

---

## 📎 Requirements

- Visual Studio Code
- AL Language Extension (by Microsoft)
- Node.js (to build and debug the extension)

---

## 📸 Screenshots
### 🧭 Find the view
> ![alt text](./media/ALInterfacetracker_ss1.png)

### 🔍 Check Interface
> ![alt text](./media/ALInterfacetracker_ss2.png)

---

## 🤝 Contributing

Contributions are welcome! Please:

- Open issues for bugs or ideas.
- Submit PRs to enhance the extension.

---

## 📃 License

This project is licensed under the [MIT License].

---

Built with ❤️ for Business Central developers.
