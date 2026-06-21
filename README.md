# ZK-19 山区输电线路无人机巡检缺陷识别与工单闭环平台

面向山区输电线路运维场景的无人机巡检数字化平台，实现线路地图建模、无人机航线管理、绝缘子与塔体缺陷识别、隐患告警、巡检影像回放、消缺工单流转和高发故障区段统计分析。

## 技术栈

- **后端**: Django 4.2 + Django REST Framework + PostGIS
- **前端**: React 18 + TypeScript + Vite + TailwindCSS + zustand
- **地图**: Leaflet + react-leaflet
- **图表**: Recharts
- **异步任务**: Celery + RabbitMQ
- **MQTT通讯**: EMQX + paho-mqtt
- **数据库**: PostgreSQL 15 + PostGIS 3.4
- **部署**: Docker Compose

---

## 无人机 MQTT 通讯协议

### 1. 概述

无人机与平台通过 MQTT 协议进行双向通信，采用发布/订阅模式。平台使用 EMQX 作为 MQTT Broker，默认端口 1883，Dashboard 端口 18083。

### 2. Broker 配置

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| 主机 | MQTT_BROKER_HOST | localhost | Broker 地址 |
| 端口 | MQTT_BROKER_PORT | 1883 | Broker 端口 |
| 用户名 | MQTT_USERNAME | (空) | 认证用户名 |
| 密码 | MQTT_PASSWORD | (空) | 认证密码 |
| TLS | MQTT_USE_TLS | False | 是否启用 SSL/TLS |
| 心跳 | MQTT_KEEPALIVE | 60 | 保持连接秒数 |

### 3. Topic 规范

Topic 格式统一为 `drone/{device_id}/{message_type}`，其中 `{device_id}` 为无人机序列号或ID。

#### 3.1 无人机 → 平台（上行，无人机发布）

| Topic | 说明 | QoS | 频率 |
|-------|------|-----|------|
| `drone/{device_id}/heartbeat` | 心跳上报 | 1 | 每10秒 |
| `drone/{device_id}/telemetry` | 遥测数据上报 | 1 | 每2秒 |
| `drone/{device_id}/event` | 事件/异常告警 | 2 | 事件触发时 |
| `drone/{device_id}/media` | 媒体文件上报 | 1 | 拍摄完成时 |
| `drone/{device_id}/task_summary` | 任务汇总/进度上报 | 1 | 每5秒 |
| `drone/{device_id}/response` | 响应平台指令 | 1 | 收到指令后 |

#### 3.2 平台 → 无人机（下行，无人机订阅）

| Topic | 说明 | QoS |
|-------|------|-----|
| `drone/{device_id}/cmd` | 通用指令 | 1 |
| `drone/{device_id}/task_bind` | 任务绑定（任务ID/航线ID/线路ID） | 2 |
| `drone/{device_id}/task_control` | 任务控制（开始/暂停/恢复/停止） | 2 |
| `drone/broadcast/cmd` | 广播指令（所有无人机） | 2 |

### 4. 通用消息结构

所有上行消息共用基础字段：

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_type": "heartbeat | telemetry | event | media | task_summary",
  "report_time": "2026-06-21T10:30:00.000Z",
  "serial_number": "SN-DRONE-0001",
  "model": "DJI-Matrice-300",
  "firmware_version": "v1.2.3"
}
```

### 5. 上报类型详细说明

---

#### 5.1 心跳上报 (heartbeat)

**Topic**: `drone/{device_id}/heartbeat`  
**频率**: 建议 5~10 秒 / 次  
**用途**: 平台根据心跳判断无人机是否在线（超过60秒无心跳判定为离线）

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_time": "2026-06-21T10:30:00.000Z",
  "report_type": "heartbeat",
  "serial_number": "SN-DRONE-0001",
  "model": "DJI-Matrice-300",
  "firmware_version": "v1.2.3",
  "battery": 85,
  "signal_strength": 92,
  "latitude": 30.659800,
  "longitude": 104.065700,
  "altitude": 52.3,
  "speed": 8.2,
  "heading": 135.0,
  "status": "idle | busy | maintenance | offline",
  "current_task_id": 101
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| device_id | string | 是 | 设备标识（序列号优先） |
| report_time | string | 是 | ISO8601 UTC 时间戳 |
| battery | int | 否 | 电量百分比 0-100 |
| signal_strength | int | 否 | 信号强度 0-100 |
| latitude | float | 否 | 纬度 WGS84 |
| longitude | float | 否 | 经度 WGS84 |
| altitude | float | 否 | 相对高度（米） |
| speed | float | 否 | 速度 m/s |
| heading | float | 否 | 航向角 0-360 度 |
| status | string | 否 | 无人机状态 |
| current_task_id | int | 否 | 当前执行的任务ID |

---

#### 5.2 遥测上报 (telemetry)

**Topic**: `drone/{device_id}/telemetry`  
**频率**: 建议 1~2 秒 / 次（实时飞行数据）

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_time": "2026-06-21T10:30:02.000Z",
  "report_type": "telemetry",
  "latitude": 30.660100,
  "longitude": 104.066200,
  "altitude": 50.5,
  "speed": 7.8,
  "heading": 132.4,
  "battery": 84,
  "signal_strength": 90,
  "satellites": 14,
  "temperature": 28.5,
  "wind_speed": 3.2,
  "task_id": 101,
  "extra_data": {
    "roll": 1.2,
    "pitch": -2.1,
    "yaw": 132.4,
    "gimbal_angle": -90.0
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| latitude | float | 是 | 纬度 |
| longitude | float | 是 | 经度 |
| altitude | float | 否 | 高度（米） |
| speed | float | 否 | 地速 m/s |
| heading | float | 否 | 航向角 |
| battery | int | 否 | 电量 % |
| signal_strength | int | 否 | 信号强度 % |
| satellites | int | 否 | GPS 卫星数 |
| temperature | float | 否 | 设备温度 ℃ |
| wind_speed | float | 否 | 风速 m/s |
| task_id | int | 否 | 关联任务ID |
| extra_data | object | 否 | 扩展数据（姿态、云台角度等） |

---

#### 5.3 任务汇总上报 (task_summary)

**Topic**: `drone/{device_id}/task_summary`  
**频率**: 建议 5~10 秒 / 次  
**用途**: 平台根据此消息计算任务进度、更新任务状态

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_time": "2026-06-21T10:35:00.000Z",
  "report_type": "task_summary",
  "task_id": 101,
  "route_id": 25,
  "line_id": 8,
  "task_status": "cruising",
  "flight_phase": "巡航中",
  "current_waypoint_index": 6,
  "total_waypoints": 15,
  "progress": 40.0,
  "flight_distance": 2000.5,
  "remaining_distance": 3000.0,
  "elapsed_time": 600,
  "remaining_time": 900,
  "photos_taken": 24,
  "videos_recorded": 2,
  "battery_used": 16,
  "battery": 84,
  "latitude": 30.661200,
  "longitude": 104.067500,
  "altitude": 50.0,
  "speed": 8.0,
  "heading": 130.0,
  "extra_data": {
    "next_waypoint": {"lon": 104.068000, "lat": 30.661500},
    "estimated_landing_battery": 35
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | int | 是 | 任务ID（后台创建时分配） |
| route_id | int | 否 | 航线ID |
| line_id | int | 否 | 线路ID |
| task_status | string | 是 | 任务状态枚举 |
| flight_phase | string | 否 | 飞行阶段描述 |
| current_waypoint_index | int | 否 | 当前航点索引（从0开始） |
| total_waypoints | int | 否 | 总航点数 |
| progress | float | 否 | 任务进度 0-100 % |
| flight_distance | float | 否 | 已飞行距离 米 |
| remaining_distance | float | 否 | 剩余距离 米 |
| elapsed_time | int | 否 | 已用时间 秒 |
| remaining_time | int | 否 | 预计剩余时间 秒 |
| photos_taken | int | 否 | 已拍摄照片数 |
| videos_recorded | int | 否 | 已录制视频数 |
| battery_used | int | 否 | 已消耗电量 % |
| latitude/longitude/altitude | float | 否 | 当前位置 |
| speed/heading | float | 否 | 速度航向 |

**task_status 枚举值**:
| 值 | 说明 | 对应任务状态 |
|----|------|------------|
| `takeoff` | 起飞 | running |
| `climbing` | 爬升中 | running |
| `cruising` | 巡航中 | running |
| `turning` | 转弯中 | running |
| `descending` | 下降中 | running |
| `landing` | 降落中 | running |
| `paused` | 暂停 | paused |
| `returning` | 返航中 | running |
| `completed` | 任务完成 | completed |
| `aborted` | 任务中止 | cancelled |
| `error` | 异常中断 | cancelled |

---

#### 5.4 媒体上报 (media)

**Topic**: `drone/{device_id}/media`  
**频率**: 拍摄完成后立即上报（文件先上传云平台，再推访问链接）

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_time": "2026-06-21T10:35:30.000Z",
  "report_type": "media",
  "task_id": 101,
  "media_type": "image | video | panorama",
  "file_name": "TASK20260621_0024.jpg",
  "file_url": "https://oss.example.com/drone-media/.../TASK20260621_0024.jpg",
  "thumbnail_url": "https://oss.example.com/...thumb.jpg",
  "file_size": 5242880,
  "duration": 0,
  "latitude": 30.661500,
  "longitude": 104.068000,
  "altitude": 50.0,
  "heading": 130.0,
  "tower_id": 127,
  "extra_data": {
    "camera_model": "H20T",
    "resolution": "6400x4800",
    "exif": {"shutter": "1/1000", "iso": 100}
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| task_id | int | 否 | 任务ID（如在执行任务） |
| media_type | string | 是 | `image` / `video` / `panorama` |
| file_name | string | 是 | 文件名 |
| file_url | string | 是 | 云平台访问 URL |
| thumbnail_url | string | 否 | 缩略图 URL（图片类型） |
| file_size | int | 否 | 文件大小（字节） |
| duration | int | 否 | 视频时长（秒），图片为0 |
| latitude/longitude | float | 否 | 拍摄位置 |
| altitude | float | 否 | 拍摄高度 |
| heading | float | 否 | 拍摄时航向 |
| tower_id | int | 否 | 关联杆塔 ID（如已识别） |

---

#### 5.5 事件上报 (event)

**Topic**: `drone/{device_id}/event`  
**频率**: 事件触发时上报，QoS=2 保证送达

```json
{
  "device_id": "SN-DRONE-0001",
  "drone_id": 1,
  "report_time": "2026-06-21T10:36:00.000Z",
  "report_type": "event",
  "event_level": "warning",
  "event_category": "battery",
  "event_code": "BATTERY_LOW_20",
  "title": "电量低于20%",
  "description": "当前电量18%，建议立即返航",
  "latitude": 30.662000,
  "longitude": 104.068500,
  "altitude": 48.0,
  "extra_data": {
    "battery_cells": [3.78, 3.79, 3.77, 3.78, 3.79, 3.77],
    "estimated_remaining_flight": 180
  }
}
```

**event_level 枚举**: `info`（信息） | `warning`（警告） | `error`（异常） | `critical`（严重）  
**event_category 枚举**: `battery` | `signal` | `weather` | `flight` | `device` | `obstacle` | `other`

> 注意：`error` 和 `critical` 级别的事件会自动同步到平台告警中心，生成告警记录。

---

### 6. 任务绑定与控制（下行消息）

#### 6.1 任务绑定推送

**触发**: 后台点击"开始任务"时自动推送  
**Topic**: `drone/{device_id}/task_bind`  
**QoS**: 2（保证送达）

```json
{
  "command": "task_bind",
  "timestamp": 1718965800000,
  "data": {
    "task_id": 101,
    "task_code": "TASK20260621A001",
    "task_name": "110kV某线#35-#50巡检",
    "route_id": 25,
    "route_name": "110kV某线-南线-巡检航线",
    "line_id": 8,
    "line_name": "110kV某线",
    "pilot_id": 5,
    "pilot_name": "张三",
    "planned_date": "2026-06-21",
    "altitude": 50,
    "speed": 8,
    "waypoints_geom": [
      [104.065700, 30.659800],
      [104.066500, 30.660500],
      [104.067200, 30.661100]
    ],
    "waypoints": [
      {"lon": 104.065700, "lat": 30.659800, "alt": 50, "speed": 8, "action": "photo"},
      {"lon": 104.066500, "lat": 30.660500, "alt": 50, "speed": 8, "action": "photo"}
    ],
    "total_distance": 5200,
    "estimated_duration": 650,
    "issued_at": "2026-06-21T10:30:00.000Z",
    "token": "mqtt-auth-token-xxx"
  }
}
```

无人机收到后需通过 `drone/{device_id}/response` 回复确认。

#### 6.2 任务控制

**Topic**: `drone/{device_id}/task_control`

| action | 说明 |
|--------|------|
| `start` | 开始执行任务（起飞） |
| `pause` | 悬停暂停 |
| `resume` | 继续执行 |
| `stop` | 立即停止任务并降落 |
| `return_home` | 立即返航 |

```json
{
  "command": "pause",
  "timestamp": 1718965800000,
  "data": {"reason": "气象条件突变"}
}
```

#### 6.3 响应确认

**Topic**: `drone/{device_id}/response`

```json
{
  "report_time": "2026-06-21T10:30:01.000Z",
  "command": "task_bind",
  "success": true,
  "message": "任务绑定成功，已载入15个航点",
  "data": {
    "loaded_waypoints": 15,
    "estimated_battery_need": 55
  }
}
```

---

### 7. MQTT 相关 HTTP API

所有接口前缀 `/api/mqtt/`，需要 JWT 认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mqtt/config/config/` | 获取 MQTT Broker 连接配置 |
| GET | `/api/mqtt/config/topics/` | 获取 Topic 模板列表 |
| GET | `/api/mqtt/drones/` | 无人机MQTT状态列表（含topics） |
| GET | `/api/mqtt/drones/:id/status/` | 单无人机详细状态+近1小时统计 |
| GET | `/api/mqtt/drones/:id/token/` | 获取MQTT认证Token（需admin） |
| POST | `/api/mqtt/drones/:id/regenerate_token/` | 重新生成Token（需admin） |
| POST | `/api/mqtt/drones/:id/send_command/` | 向无人机发送通用指令 |
| GET | `/api/mqtt/telemetries/by_drone/?drone_id=1&hours=1` | 按无人机查历史遥测 |
| GET | `/api/mqtt/events/` | 无人机事件列表 |
| POST | `/api/mqtt/events/:id/handle/` | 标记事件已处理 |
| GET | `/api/mqtt/media-reports/` | 媒体上报记录列表 |
| GET | `/api/mqtt/task-summaries/by_task/?task_id=101` | 按任务查汇总记录 |
| POST | `/api/mqtt/task-push/bind_task/` | 手动推送任务绑定 |
| POST | `/api/mqtt/task-push/task_control/` | 手动发送任务控制指令 |

---

### 8. 启动MQTT消费者与模拟器

#### 8.1 启动MQTT消费者（订阅无人机上报）

```bash
# Docker 方式（已在 docker-compose.yml 中定义）
docker compose up -d mqtt_consumer

# 本地开发方式
cd backend
pip install paho-mqtt requests
python manage.py mqtt_consumer

# 仅检查配置
python manage.py mqtt_consumer --once
```

#### 8.2 启动无人机模拟器（开发测试用）

```bash
# 启动3架模拟无人机，自动连接本地Broker
cd backend
python manage.py run_drone_simulator --count 3

# 启动后立即开始模拟任务飞行
python manage.py run_drone_simulator --count 3 --start-tasks

# 指定Broker地址与认证
python manage.py run_drone_simulator \
  --broker emqx.example.com \
  --port 1883 \
  --username zk19 \
  --password zk19_pass \
  --count 5

# 从API加载真实无人机数据（需先登录获取JWT Token）
python manage.py run_drone_simulator \
  --api-token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  --api-base http://localhost:8000
```

模拟器会实时在终端显示各无人机状态：
```
模拟无人机-1: st=cru batt=78% alt=50m wp=6/15 | 模拟无人机-2: st=idle batt=95% alt=0m wp=0/0
```

模拟器会模拟完整飞行流程：起飞→爬升→巡航（航点逐个到达+拍摄照片/视频）→返航→降落，期间定时发送5类上报，并随机产生各种事件。

---

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
