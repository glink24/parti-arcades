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

推送到 `main` 分支后，GitHub Actions 自动将每个游戏同步到对应的 `market-*` 分支。
通过 [Parti 房间市场](https://github.com/glink25/Parti/issues) 注册上架。

## 新增游戏

```bash
sh scripts/new-game.sh my-game-name
```

编辑生成的三件套后推送即可。
