import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Space,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { CaretRightOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

function formatTime(value) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export default function TaskDetailPage({
  taskDetail,
  providers,
  pendingApprovals,
  onResolveApproval,
  roleLabelMap,
  taskStatusColor,
  onBackToList,
  onRunTask,
  onCancelTask,
  onRetryAgent,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(taskDetail?.agents?.[0]?.id || '');
  const [detailTab, setDetailTab] = useState('timeline');
  const timelineRef = useRef(null);

  const selectedAgent = useMemo(
    () => taskDetail?.agents?.find((agent) => agent.id === selectedAgentId) || taskDetail?.agents?.[0] || null,
    [selectedAgentId, taskDetail]
  );

  const detailLogs = useMemo(() => {
    if (!taskDetail) return [];
    if (detailTab === 'timeline') return taskDetail.logs;
    if (!selectedAgent) return taskDetail.logs;
    return taskDetail.logs.filter((log) => !log.agentId || log.agentId === selectedAgent.id);
  }, [detailTab, selectedAgent, taskDetail]);

  const selectedAgentOperationLogs = useMemo(() => {
    if (!taskDetail || !selectedAgent) return [];
    return taskDetail.logs.filter((log) => log.agentId === selectedAgent.id && log.direction === 'tool');
  }, [taskDetail, selectedAgent]);

  const taskPendingApprovals = useMemo(() => {
    const list = Array.isArray(pendingApprovals) ? pendingApprovals : [];
    return list;
  }, [pendingApprovals]);

  useEffect(() => {
    if (detailTab !== 'timeline') return;
    const node = timelineRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [detailTab, detailLogs.length, taskPendingApprovals.length]);

  if (!taskDetail) {
    return (
      <Card className="tool-entry workspace-empty-card">
        <Empty description="任务不存在或已删除。" />
      </Card>
    );
  }

  return (
    <>
      <Card className="tool-entry workspace-detail-card">
        <Flex justify="space-between" align="start" gap={16} wrap="wrap">
          <div>
            <Flex gap={8} align="center" wrap="wrap">
              <Typography.Title level={4} style={{ margin: 0 }}>{taskDetail.task.title}</Typography.Title>
              <Tag color={taskStatusColor[taskDetail.task.status] || 'default'}>{taskDetail.task.status}</Tag>
            </Flex>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 10 }}>
              {taskDetail.task.goal}
            </Typography.Paragraph>
          </div>
          <Space wrap>
            {(taskDetail.task.status === 'queued' || taskDetail.task.status === 'failed' || taskDetail.task.status === 'cancelled') && (
              <Button type="primary" icon={<CaretRightOutlined />} onClick={() => onRunTask(taskDetail.task.id)}>
                启动任务
              </Button>
            )}
            {(taskDetail.task.status === 'running' || taskDetail.task.status === 'paused') && (
              <Button danger icon={<PauseCircleOutlined />} onClick={() => onCancelTask(taskDetail.task.id)}>
                取消任务
              </Button>
            )}
          </Space>
        </Flex>

        <Descriptions size="small" column={3} style={{ marginTop: 16 }}>
          <Descriptions.Item label="工作目录">{taskDetail.task.workingDirectory || '-'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatTime(taskDetail.task.createdAt)}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{formatTime(taskDetail.task.finishedAt)}</Descriptions.Item>
        </Descriptions>
      </Card>

      <div className="workspace-detail-panels">
        {taskPendingApprovals.length > 0 && (
          <Card className="tool-entry workspace-flow-card" title={`待审批命令 (${taskPendingApprovals.length})`}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {taskPendingApprovals.map((approval) => (
                <Card key={approval.approvalId} size="small" className="workspace-approval-card">
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Text strong>待审批命令</Typography.Text>
                    <Typography.Text type="secondary">{approval.agentName || approval.agentId || 'unknown agent'}</Typography.Text>
                    <pre className="workspace-code-block" style={{ minHeight: 72, maxHeight: 140 }}>{String(approval.command || '')}</pre>
                    <Space wrap>
                      <Button size="small" type="primary" onClick={() => onResolveApproval?.(approval.approvalId, true, false)}>允许一次</Button>
                      <Button size="small" onClick={() => onResolveApproval?.(approval.approvalId, true, true)}>允许并加入全局白名单</Button>
                      <Button size="small" danger onClick={() => onResolveApproval?.(approval.approvalId, false, false)}>拒绝</Button>
                    </Space>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        )}

        <Card className="tool-entry workspace-flow-card" title="任务编排">
          {taskDetail.agents.length === 0 ? (
            <Empty description="该任务没有 agent 步骤" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="workspace-agent-flow">
              {taskDetail.agents.map((agent) => (
                <div key={agent.id} className={`workspace-agent-node${selectedAgent?.id === agent.id ? ' active' : ''}`} onClick={() => setSelectedAgentId(agent.id)}>
                  <Flex justify="space-between" align="start" gap={8}>
                    <div>
                      <Typography.Text strong>{agent.name}</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ margin: '6px 0 0' }}>
                        {agent.role ? (roleLabelMap[agent.role] || agent.role) : '未指定角色'}
                      </Typography.Paragraph>
                    </div>
                    <Tag color={taskStatusColor[agent.status] || 'default'}>{agent.status}</Tag>
                  </Flex>
                  <div className="workspace-agent-meta">
                    <Typography.Text type="secondary">Provider: {providers.find((item) => item.id === agent.providerId)?.name || agent.providerId}</Typography.Text>
                    <Typography.Text type="secondary">依赖: {agent.dependsOn.length ? agent.dependsOn.map((dependencyId) => taskDetail.agents.find((item) => item.id === dependencyId)?.name || dependencyId).join(' / ') : '无'}</Typography.Text>
                  </div>
                  {agent.status === 'failed' && onRetryAgent && (
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      style={{ marginTop: 8 }}
                      onClick={(e) => { e.stopPropagation(); onRetryAgent(taskDetail.task.id, agent.id); }}
                    >
                      重试此步骤
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="tool-entry workspace-log-card" title={selectedAgent ? `${selectedAgent.name} 输出视图` : '输出视图'}>
          {!selectedAgent ? (
            <Empty description="暂无 Agent" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Tabs
              activeKey={detailTab}
              onChange={setDetailTab}
              items={[
                {
                  key: 'timeline',
                  label: '时间线',
                  children: (
                    <div className="workspace-log-stream" ref={timelineRef}>
                      {detailLogs.length === 0 ? <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : detailLogs.map((log) => (
                        <div key={log.id} className={`workspace-log-line level-${log.level}`}>
                          <span className="workspace-log-time">{dayjs(log.createdAt).format('HH:mm:ss')}</span>
                          <Tag bordered={false}>{log.direction}</Tag>
                          <span className="workspace-log-message">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  ),
                },
                {
                  key: 'input',
                  label: '输入',
                  children: <pre className="workspace-code-block">{selectedAgent.inputText || '暂无输入'}</pre>,
                },
                {
                  key: 'output',
                  label: '输出',
                  children: (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Card size="small" title="结果描述">
                        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                          {selectedAgent.outputText || selectedAgent.errorText || '暂无输出'}
                        </Typography.Paragraph>
                      </Card>
                      <Card size="small" title="执行操作">
                        {selectedAgentOperationLogs.length === 0 ? (
                          <Empty description="暂无操作记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        ) : (
                          <div className="workspace-log-stream" style={{ height: 240 }}>
                            {selectedAgentOperationLogs.map((log) => (
                              <div key={log.id} className={`workspace-log-line level-${log.level}`}>
                                <span className="workspace-log-time">{dayjs(log.createdAt).format('HH:mm:ss')}</span>
                                <Tag bordered={false}>{log.direction}</Tag>
                                <span className="workspace-log-message">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </Space>
                  ),
                },
                {
                  key: 'usage',
                  label: '额度',
                  children: (
                    <Descriptions size="small" column={2} bordered>
                      <Descriptions.Item label="Prompt Tokens">{selectedAgent.usage?.promptTokens ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="Completion Tokens">{selectedAgent.usage?.completionTokens ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="Total Tokens">{selectedAgent.usage?.totalTokens ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="估算花费 USD">{selectedAgent.usage?.estimatedCostUsd ?? '-'}</Descriptions.Item>
                      <Descriptions.Item label="Provider">{providers.find((item) => item.id === selectedAgent.providerId)?.name || selectedAgent.providerId}</Descriptions.Item>
                      <Descriptions.Item label="计量来源">{selectedAgent.usage?.source || 'local'}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>
    </>
  );
}
