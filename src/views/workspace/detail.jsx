import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Empty, Flex, Spin } from 'antd';
import { ArrowLeftOutlined, HomeOutlined } from '@ant-design/icons';
import BreadcrumbNav from '../../components/BreadcrumbNav';
import TaskDetailPage from './components/TaskDetailPage';
import './index.scss';

export default function WorkspaceTaskDetailPage({ taskId, onBack, onBackHome }) {
  const [loading, setLoading] = useState(true);
  const [taskDetail, setTaskDetail] = useState(null);
  const [providers, setProviders] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const refreshTimerRef = useRef(null);

  // Initial load (shows spinner). Background refreshes are silent.
  const load = useCallback(async (silent = false) => {
    if (!taskId) {
      setTaskDetail(null);
      setProviders([]);
      setPendingApprovals([]);
      if (!silent) setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const [overview, detail, pendingResp] = await Promise.all([
        window.developerBox.getWorkspaceOverview(),
        window.developerBox.getWorkspaceTaskDetail(taskId),
        window.developerBox.getWorkspacePendingCommandApprovals(taskId),
      ]);
      setProviders(overview?.providers || []);
      setTaskDetail(detail || null);
      setPendingApprovals(pendingResp?.ok ? (pendingResp.data || []) : []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const unsubscribe = window.developerBox.onWorkspaceRuntimeEvent((event) => {
      if (event.taskId !== taskId) return;

      if (event.type === 'command-approval-required') {
        setPendingApprovals((current) => {
          if (current.some((item) => item.approvalId === event.approvalId)) return current;
          return [...current, {
            approvalId: event.approvalId,
            agentId: event.agentId,
            agentName: event.agentName,
            command: event.command,
            at: event.at || new Date().toISOString(),
          }];
        });
      }

      if (event.type === 'log') {
        // Append log entry directly to avoid full reload on every streamed line
        setTaskDetail((prev) => {
          if (!prev) return prev;
          const entry = {
            id: `live-${Date.now()}-${Math.random()}`,
            agentId: event.agentId || null,
            level: event.level || 'info',
            direction: event.direction || 'system',
            message: event.message || '',
            createdAt: event.at || new Date().toISOString(),
          };
          return { ...prev, logs: [...prev.logs, entry] };
        });
      } else {
        // Status/error events: debounced silent full reload to sync agent states
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => load(true), 150);
      }
    });
    return () => {
      unsubscribe();
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [taskId, load]);

  return (
    <section className="content-area workspace-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: '工作区', onClick: onBack }, { title: '任务详情' }]} />
        <Flex gap={8}>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>

      {loading ? (
        <Flex justify="center" align="center" className="workspace-loading"><Spin /></Flex>
      ) : !taskDetail ? (
        <Empty description="任务不存在或已删除。" />
      ) : (
        <TaskDetailPage
          taskDetail={taskDetail}
          providers={providers}
          pendingApprovals={pendingApprovals}
          onResolveApproval={async (approvalId, allow, remember) => {
            await window.developerBox.resolveWorkspaceCommandApproval({ approvalId, allow, remember });
            setPendingApprovals((current) => current.filter((item) => item.approvalId !== approvalId));
            await load(true);
          }}
          roleLabelMap={{
            architect: '架构师',
            planner: '规划师',
            executor: '执行者',
            debugger: '调试专家',
            verifier: '验证者',
            reviewer: '评审者',
            researcher: '研究员',
            designer: '设计师',
          }}
          taskStatusColor={{
            queued: 'blue',
            running: 'gold',
            completed: 'green',
            failed: 'red',
            paused: 'orange',
            cancelled: 'default',
            pending: 'default',
            skipped: 'purple',
          }}
          onBackToList={onBack}
          onRunTask={async (nextTaskId) => {
            await window.developerBox.startWorkspaceTask(nextTaskId);
            await load();
          }}
          onCancelTask={(nextTaskId) => window.developerBox.cancelWorkspaceTask(nextTaskId)}
                  onRetryAgent={async (retryTaskId, agentId) => {
                    await window.developerBox.retryWorkspaceTaskAgent(retryTaskId, agentId);
                    await load();
                  }}
        />
      )}
    </section>
  );
}
