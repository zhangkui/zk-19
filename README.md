# ZK-19 山区输电线路无人机巡检缺陷识别与工单闭环平台

面向山区输电线路运维场景的无人机巡检数字化平台，实现线路地图建模、无人机航线管理、绝缘子与塔体缺陷识别、隐患告警、巡检影像回放、消缺工单流转和高发故障区段统计分析。

## 技术栈

- **后端**: Django 4.2 + Django REST Framework + PostGIS
- **前端**: React 18 + TypeScript + Vite + TailwindCSS + zustand
- **地图**: Leaflet + react-leaflet
- **图表**: Recharts
- **异步任务**: Celery + RabbitMQ
- **数据库**: PostgreSQL 15 + PostGIS 3.4
- **部署**: Docker Compose

## 功能模块

### 1. 总览大屏
- 线路/杆塔/无人机在线状态统计
- 当日巡检进度、缺陷与告警统计
- 空间地图展示线路、杆塔、告警点

### 2. 线路地图建模
- PostGIS 线路与杆塔空间建模
- 杆塔定位、通道走廊可视化
- 线路-区段-杆塔层级管理

### 3. 无人机航线管理
- 航线航点编辑与地图展示
- 航线与杆塔关联
- 航线参数配置（高度、速度、预计时长）

### 4. 巡检任务
- 基于航线创建任务
- 无人机与飞手绑定
- 任务状态流转（待执行/执行中/已完成）
- 巡检影像上传与 AI 自动识别

### 5. 缺陷识别
- 绝缘子破损/串污秽、塔体锈蚀/螺栓缺失等 AI 识别结果
- 缺陷审核（确认/驳回）
- 缺陷类型与严重程度管理

### 6. 隐患告警
- 按缺陷严重度自动告警
- 告警中心列表与处置
- 告警级别统计

### 7. 巡检影像回放
- 按任务/杆塔回放巡检影像
- 影像时间轴浏览
- 地图点位联动

### 8. 消缺工单
- 工单创建/派发/接单/消缺/复核闭环流转
- 工单流转时间线
- 责任人管理

### 9. 高发故障区段统计分析
- 按区段聚合缺陷频次
- 地图热力图展示
- 缺陷类型/时间趋势分析
- 缺陷杆塔排名

## 快速开始

### Docker Compose 部署（推荐）

```bash
# 1. 克隆项目
cd zk-19

# 2. 启动所有服务
docker compose up -d --build

# 3. 执行数据库迁移
docker compose exec api python manage.py migrate

# 4. 初始化演示数据
docker compose exec api python manage.py init_demo

# 5. 创建超级管理员（可选）
docker compose exec api python manage.py createsuperuser
```

访问地址：
- 前端: http://localhost:5173
- 后端 API: http://localhost:8000
- Admin 后台: http://localhost:8000/admin
- RabbitMQ 管理: http://localhost:15672 (zk19 / zk19_pass)

### 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin | 调度管理员 |
| pilot1 | pilot123 | 无人机飞手 |
| reviewer1 | reviewer123 | 缺陷审核员 |
| crew1 | crew123 | 检修班组 |

## 项目结构

```
zk-19/
├── backend/                 # Django 后端
│   ├── zk19/               # 项目配置
│   │   ├── settings.py     # Django 设置
│   │   ├── celery.py       # Celery 配置
│   │   ├── urls.py         # 路由配置
│   │   └── ...
│   ├── accounts/           # 用户账户模块
│   ├── lines/              # 线路杆塔模块 (PostGIS)
│   ├── inspection/         # 巡检模块 (无人机/航线/任务/缺陷/告警)
│   ├── ops/                # 运维工单模块
│   ├── stats/              # 统计分析模块
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # 公共组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API 服务
│   │   ├── store/          # 状态管理
│   │   ├── types/          # TypeScript 类型
│   │   ├── utils/          # 工具函数
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── Dockerfile
├── docker-compose.yml      # Docker Compose 配置
├── .env.example            # 环境变量示例
└── README.md
```

## API 接口

采用 JWT 认证，统一前缀 `/api`。

### 认证
- `POST /api/auth/login/` - 登录
- `POST /api/auth/refresh/` - 刷新 Token

### 线路/杆塔
- `GET/POST /api/lines/` - 线路列表/创建
- `GET/PUT/DELETE /api/lines/:id/` - 线路详情/更新/删除
- `GET/POST /api/towers/` - 杆塔列表/创建
- `GET/PUT/DELETE /api/towers/:id/` - 杆塔详情

### 航线
- `GET/POST /api/flight-routes/` - 航线列表/创建
- `GET/PUT/DELETE /api/flight-routes/:id/` - 航线详情

### 巡检任务
- `GET/POST /api/tasks/` - 任务列表/创建
- `GET /api/tasks/:id/` - 任务详情
- `POST /api/tasks/:id/upload/` - 上传巡检影像
- `POST /api/tasks/:id/start/` - 开始任务
- `POST /api/tasks/:id/complete/` - 完成任务

### 缺陷
- `GET /api/defects/` - 缺陷列表
- `GET /api/defects/:id/` - 缺陷详情
- `POST /api/defects/:id/review/` - 审核缺陷

### 告警
- `GET /api/alerts/` - 告警列表
- `GET /api/alerts/:id/` - 告警详情
- `POST /api/alerts/:id/handle/` - 处置告警

### 工单
- `GET/POST /api/workorders/` - 工单列表/创建
- `GET /api/workorders/:id/` - 工单详情
- `POST /api/workorders/:id/transition/` - 工单状态流转

### 统计
- `GET /api/stats/overview/` - 大屏 KPI
- `GET /api/stats/sections/` - 区段缺陷统计
- `GET /api/stats/lines/` - 线路缺陷统计
- `GET /api/stats/tower_rank/` - 杆塔缺陷排名
- `GET /api/stats/trends/` - 缺陷趋势
- `GET /api/stats/heatmap/` - 热力图数据

## 核心流程

1. 调度员基于线路与航线创建巡检任务
2. 飞手执行并上传巡检影像
3. Celery 异步触发 AI 缺陷识别（模拟）
4. 识别结果进入审核队列
5. 审核员确认缺陷并按严重度生成告警
6. 自动生成消缺工单并派发
7. 检修班组消缺并申请复核
8. 复核通过后工单闭环
9. 缺陷空间数据沉淀用于高发故障区段统计

## 开发说明

### 后端开发

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 前端开发

```bash
cd frontend
pnpm install  # 或 npm install
pnpm dev
```

### Celery Worker

```bash
cd backend
celery -A zk19 worker --loglevel=info
celery -A zk19 beat --loglevel=info
```
