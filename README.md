# Parti Arcades

基于 [Parti](https://github.com/glink25/Parti) 平台的小游戏合集，和朋友一起创造，一起游玩。

## 游戏列表

| 游戏 | 玩家人数 | 市场安装 |
|------|---------|----------|
| 德州扑克 | 2-6 人 | `[parti-room] glink24/parti-arcades@market-texas-holdem` |
| 井字棋 | 2 人 | `[parti-room] glink24/parti-arcades@market-tic-tac-toe` |

## 架构

```
parti-arcades/
├── games/                    # 所有游戏源码（main 分支）
│   ├── texas-holdem/
│   ├── tic-tac-toe/
│   └── <new-game>/
├── .github/workflows/        # 自动同步到市场分支
├── scripts/                  # 脚手架工具
└── README.md
```

每个游戏目录包含 Parti 标准三件套：
- `parti.room.json` — 房间元信息
- `index.html` — UI 入口
- `room.worker.js` — 权威游戏逻辑

## 发布流程

推送到 `main` 分支后，GitHub Actions 自动将每个游戏同步到对应的 `market-*` 分支，并自动刷新 [Parti 房间市场](https://github.com/glink25/Parti/issues) 中对应 Issue 的 triage 检查。

### 启用自动刷市场 Issue（可选）

1. 在 `glink24` 账号的 [Personal Access Tokens](https://github.com/settings/tokens) 创建一个 **Classic Token**，勾选 `public_repo` 权限
2. 在 `glink24/parti-arcades` → Settings → Secrets and variables → Actions，添加 Secret：
   - Name: `MARKET_REGISTRY_TOKEN`
   - Value: 上一步生成的 Token
3. 之后每次推送到 `main`，游戏同步完成后会自动编辑对应 Issue 触发 triage 刷新

> 不配置 Token 时，CI 仍然会同步 `market-*` 分支，但需要手动编辑 Issue 触发 re-triage。

## 新增游戏

```bash
sh scripts/new-game.sh my-game-name
```

编辑生成的三件套后推送即可。
