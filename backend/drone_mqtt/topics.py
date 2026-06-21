TOPIC_HEARTBEAT = 'drone/{device_id}/heartbeat'
TOPIC_TELEMETRY = 'drone/{device_id}/telemetry'
TOPIC_EVENT = 'drone/{device_id}/event'
TOPIC_MEDIA = 'drone/{device_id}/media'
TOPIC_TASK_SUMMARY = 'drone/{device_id}/task_summary'

TOPIC_CMD = 'drone/{device_id}/cmd'
TOPIC_TASK_BIND = 'drone/{device_id}/task_bind'
TOPIC_TASK_CONTROL = 'drone/{device_id}/task_control'
TOPIC_RESPONSE = 'drone/{device_id}/response'

TOPIC_BROADCAST_CMD = 'drone/broadcast/cmd'


def get_topic(template: str, device_id: str) -> str:
    return template.format(device_id=device_id)


def subscribe_patterns():
    return [
        'drone/+/heartbeat',
        'drone/+/telemetry',
        'drone/+/event',
        'drone/+/media',
        'drone/+/task_summary',
        'drone/+/response',
    ]


def parse_topic(topic: str) -> dict:
    parts = topic.split('/')
    if len(parts) < 3:
        return {}
    return {
        'prefix': parts[0],
        'device_id': parts[1] if parts[1] != 'broadcast' else None,
        'msg_type': parts[2] if len(parts) >= 3 else None,
        'is_broadcast': parts[1] == 'broadcast',
    }
