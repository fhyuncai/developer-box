import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Popconfirm,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  ApiOutlined,
  ArrowLeftOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  LinkOutlined,
  PauseCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import BreadcrumbNav from '../../components/BreadcrumbNav';
import './index.scss';

const { TextArea } = Input;

const ROLE_OPTIONS = [
  { value: 'architect', label: '架构师' },
  { value: 'planner', label: '规划师' },
  { value: 'executor', label: '执行者' },
  { value: 'debugger', label: '调试专家' },
  { value: 'verifier', label: '验证者' },
  { value: 'reviewer', label: '评审者' },
  { value: 'researcher', label: '研究员' },
  { value: 'designer', label: '设计师' },
];
const ROLE_LABEL_MAP = Object.fromEntries(ROLE_OPTIONS.map((item) => [item.value, item.label]));

const PROVIDER_KIND_OPTIONS = [
  { label: 'CLI', value: 'cli' },
  { label: 'OpenAI 兼容', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Gemini', value: 'gemini' },
];

const TASK_STATUS_COLOR = {
  queued: 'blue',
  running: 'gold',
  paused: 'orange',
  completed: 'green',
  failed: 'red',
  cancelled: 'default',
  pending: 'default',
  skipped: 'purple',
};

const TASK_DRAFT_STORAGE_KEY = 'workspace.new-task-draft.v1';

function formatTime(value) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function formatMoney(value) {
  return Number(value || 0).toFixed(4);
}

function parseJsonField(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJsonField(value) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) return '';
  return JSON.stringify(value, null, 2);
}

function normalizeProviderForm(values, current) {
  const common = {
    id: current?.id,
    name: values.name,
    kind: values.kind,
    enabled: values.enabled !== false,
    quota: {
      ...(current?.quota || {}),
      spentUsd: Number(values.spentUsd || current?.quota?.spentUsd || 0),
      balanceUsd: values.balanceUsd === undefined || values.balanceUsd === null ? current?.quota?.balanceUsd ?? null : Number(values.balanceUsd),
      remainingUsd: values.remainingUsd === undefined || values.remainingUsd === null ? current?.quota?.remainingUsd ?? null : Number(values.remainingUsd),
      source: current?.quota?.source || 'local',
    },
    runtime: current?.runtime || {},
  };

  if (values.kind === 'cli') {
    return {
      ...common,
      config: {
        ...(current?.config || {}),
        binary: values.binary || '',
        binaryCandidates: (values.binaryCandidates || '').split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
        argsTemplate: (values.argsTemplate || '').split(/\n/).map((item) => item.trim()).filter(Boolean),
        shellTemplate: values.shellTemplate || '',
        promptMode: values.promptMode || 'argv',
        quotaCommand: values.quotaCommand || '',
        proxyId: values.proxyId || '',
        env: parseJsonField(values.envJson, {}),
        pricing: {
          inputPerMillion: Number(values.inputPerMillion || 0),
          outputPerMillion: Number(values.outputPerMillion || 0),
        },
        notes: values.notes || '',
      },
      secret: current?.secret || {},
    };
  }

  return {
    ...common,
    config: {
      ...(current?.config || {}),
      baseUrl: values.baseUrl || '',
      model: values.model || '',
      proxyId: values.proxyId || '',
      headers: parseJsonField(values.headersJson, {}),
      temperature: values.temperature ?? 0.2,
      maxTokens: values.maxTokens ?? 2048,
      anthropicVersion: values.anthropicVersion || '2023-06-01',
      generationConfig: parseJsonField(values.generationConfigJson, {}),
      pricing: {
        inputPerMillion: Number(values.inputPerMillion || 0),
        outputPerMillion: Number(values.outputPerMillion || 0),
      },
    },
    secret: {
      ...(current?.secret || {}),
      apiKey: values.apiKey || '',
    },
  };
}

function normalizeProxyForm(values, current) {
  return {
    id: current?.id,
    name: values.name,
    enabled: values.enabled !== false,
    config: {
      url: values.url,
      noProxy: values.noProxy || '',
      isGlobal: current?.config?.isGlobal === true,
    },
  };
}

function hasTaskDraftContent(values) {
  if (!values || typeof values !== 'object') return false;
  if (String(values.title || '').trim()) return true;
  if (String(values.goal || '').trim()) return true;
  if (String(values.workingDirectory || '').trim()) return true;
  if (
    Array.isArray(values.steps) && values.steps.length === 1 &&
    String(values.steps[0].name || '').trim() === 'leader' && String(values.steps[0].role || '').trim() === 'planner' &&
    String(values.steps[0].instructions || '').trim() === ''
  ) {
    return false;
  }
  if (Array.isArray(values.steps) && values.steps.length > 0) return true;
  return true;
}

function isAiStepModified(step) {
  const original = step?.aiOriginal;
  if (!original) return false;
  const sameDependsOn = JSON.stringify(step?.dependsOn || []) === JSON.stringify(original.dependsOn || []);
  return !(
    String(step?.name || '') === String(original.name || '')
    && String(step?.providerId || '') === String(original.providerId || '')
    && String(step?.role || '') === String(original.role || '')
    && String(step?.model || '') === String(original.model || '')
    && String(step?.instructions || '') === String(original.instructions || '')
    && sameDependsOn
  );
}

function normalizeTaskForm(values) {
  return {
    title: values.title,
    goal: values.goal,
    workingDirectory: values.workingDirectory || '',
    orchestration: {
      mode: values.mode || 'parallel',
    },
    steps: (values.steps || []).map((step) => ({
      name: step.name,
      providerId: step.providerId,
      role: step.role,
      model: step.model || '',
      instructions: step.instructions || '',
      dependsOn: step.dependsOn || [],
    })),
    autoStart: values.autoStart !== false,
  };
}

export default function WorkspacePage({ onBack, onBackHome, onOpenTaskDetail }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState(null);
  const [providers, setProviders] = useState([]);
  const [proxies, setProxies] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [detailPageTaskId, setDetailPageTaskId] = useState('');
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [detailTab, setDetailTab] = useState('timeline');
  const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [proxyModalOpen, setProxyModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [orchestrationLoading, setOrchestrationLoading] = useState(false);
  const [orchestrationSummary, setOrchestrationSummary] = useState('');
  const [providerModelsModalOpen, setProviderModelsModalOpen] = useState(false);
  const [editingModelsProvider, setEditingModelsProvider] = useState(null);
  const [providerModelItems, setProviderModelItems] = useState([]);
  const [providerModelInput, setProviderModelInput] = useState('');
  const [globalProxyEditing, setGlobalProxyEditing] = useState(false);
  const [globalProxyAddressDraft, setGlobalProxyAddressDraft] = useState('');
  const [editingProvider, setEditingProvider] = useState(null);
  const [editingProxy, setEditingProxy] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [commandAllowlist, setCommandAllowlist] = useState([]);
  const [commandAllowlistText, setCommandAllowlistText] = useState('');
  const [commandAllowlistLoading, setCommandAllowlistLoading] = useState(false);
  const [providerForm] = Form.useForm();
  const [proxyForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const { message: messageApi, modal } = App.useApp();

  const orchestratorProviderId = Form.useWatch('orchestratorProviderId', taskForm);
  const watchedSteps = Form.useWatch('steps', taskForm) || [];
  const orchestratorProvider = useMemo(
    () => providers.find((item) => item.id === orchestratorProviderId) || null,
    [providers, orchestratorProviderId]
  );
  const orchestratorModels = useMemo(() => {
    const models = orchestratorProvider?.runtime?.models || [];
    if (models.length > 0) {
      return models.map((item) => ({ label: item.label || item.id, value: item.id }));
    }
    if (orchestratorProvider?.config?.model) {
      return [{ label: orchestratorProvider.config.model, value: orchestratorProvider.config.model }];
    }
    return [];
  }, [orchestratorProvider]);
  const globalProxyId = useMemo(() => proxies.find((item) => item.config?.isGlobal === true)?.id || '', [proxies]);
  const globalProxy = useMemo(() => proxies.find((item) => item.id === globalProxyId) || null, [proxies, globalProxyId]);

  const loadTaskDetail = async (taskId, nextTasks = tasks) => {
    if (!taskId) {
      setSelectedTaskDetail(null);
      setSelectedAgentId('');
      return;
    }
    const detail = await window.developerBox.getWorkspaceTaskDetail(taskId);
    setSelectedTaskDetail(detail);
    const firstAgentId = detail?.agents?.[0]?.id || '';
    setSelectedAgentId((current) => (detail?.agents?.some((agent) => agent.id === current) ? current : firstAgentId));
    if (!nextTasks.some((task) => task.id === taskId)) {
      setSelectedTaskId(nextTasks[0]?.id || '');
    }
  };

  const refreshWorkspace = async (preferredTaskId = selectedTaskId) => {
    setLoading(true);
    try {
      const [workspaceOverview, proxyList, taskList] = await Promise.all([
        window.developerBox.getWorkspaceOverview(),
        window.developerBox.listProxies(),
        window.developerBox.listWorkspaceTasks(),
      ]);
      setOverview(workspaceOverview);
      setProviders(workspaceOverview.providers || []);
      setProxies(proxyList);
      setTasks(taskList);
      const nextTaskId = preferredTaskId || taskList[0]?.id || '';
      setSelectedTaskId(nextTaskId);
      if (detailPageTaskId && !taskList.some((task) => task.id === detailPageTaskId)) {
        setDetailPageTaskId('');
      }
      await loadTaskDetail(nextTaskId, taskList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshWorkspace();
  }, []);

  const loadCommandAllowlist = async () => {
    setCommandAllowlistLoading(true);
    try {
      const resp = await window.developerBox.getWorkspaceCommandAllowlist();
      if (!resp?.ok) {
        throw new Error(resp?.message || '读取命令白名单失败');
      }
      const list = Array.isArray(resp.data) ? resp.data : [];
      setCommandAllowlist(list);
      setCommandAllowlistText(list.join('\n'));
    } catch (error) {
      messageApi.error(String(error?.message || error || '读取命令白名单失败'));
    } finally {
      setCommandAllowlistLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = window.developerBox.onWorkspaceRuntimeEvent((event) => {
      setTasks((current) => current.map((task) => (task.id === event.taskId ? { ...task, status: event.status || task.status, updatedAt: event.at } : task)));
      if (event.taskId === selectedTaskId) {
        loadTaskDetail(event.taskId);
      }
      window.developerBox.getWorkspaceOverview().then((nextOverview) => {
        setOverview(nextOverview);
        setProviders(nextOverview.providers || []);
      });
    });
    return unsubscribe;
  }, [selectedTaskId]);

  const selectedAgent = useMemo(
    () => selectedTaskDetail?.agents?.find((agent) => agent.id === selectedAgentId) || selectedTaskDetail?.agents?.[0] || null,
    [selectedAgentId, selectedTaskDetail]
  );

  const detailLogs = useMemo(() => {
    if (!selectedTaskDetail) return [];
    if (detailTab === 'timeline') return selectedTaskDetail.logs;
    if (!selectedAgent) return selectedTaskDetail.logs;
    return selectedTaskDetail.logs.filter((log) => !log.agentId || log.agentId === selectedAgent.id);
  }, [detailTab, selectedAgent, selectedTaskDetail]);

  const openCreateProvider = () => {
    setEditingProvider(null);
    providerForm.resetFields();
    providerForm.setFieldsValue({
      kind: 'openai',
      enabled: true,
      promptMode: 'argv',
      proxyId: '',
      temperature: 0.2,
      maxTokens: 2048,
      inputPerMillion: 0,
      outputPerMillion: 0,
    });
    setProviderModalOpen(true);
  };

  const normalizeCommandAllowlist = (input) => {
    const lines = String(input || '').split(/\r?\n/);
    const cleaned = lines.map((line) => line.trim()).filter(Boolean);
    return Array.from(new Set(cleaned));
  };

  const handleSaveCommandAllowlist = async () => {
    const next = normalizeCommandAllowlist(commandAllowlistText);
    setSaving(true);
    try {
      const resp = await window.developerBox.setWorkspaceCommandAllowlist(next);
      if (!resp?.ok) {
        throw new Error(resp?.message || '保存命令白名单失败');
      }
      const stored = Array.isArray(resp.data) ? resp.data : next;
      setCommandAllowlist(stored);
      setCommandAllowlistText(stored.join('\n'));
      messageApi.success(`命令白名单已保存，共 ${stored.length} 条`);
    } catch (error) {
      messageApi.error(String(error?.message || error || '保存命令白名单失败'));
    } finally {
      setSaving(false);
    }
  };

  const openEditProvider = (provider) => {
    setEditingProvider(provider);
    providerForm.setFieldsValue({
      name: provider.name,
      kind: provider.kind,
      enabled: provider.enabled,
      binary: provider.config?.binary || '',
      binaryCandidates: (provider.config?.binaryCandidates || []).join('\n'),
      argsTemplate: (provider.config?.argsTemplate || []).join('\n'),
      shellTemplate: provider.config?.shellTemplate || '',
      promptMode: provider.config?.promptMode || 'argv',
      quotaCommand: provider.config?.quotaCommand || '',
      proxyId: provider.config?.proxyId || '',
      envJson: stringifyJsonField(provider.config?.env),
      notes: provider.config?.notes || '',
      baseUrl: provider.config?.baseUrl || '',
      model: provider.config?.model || '',
      apiKey: provider.secret?.apiKey || '',
      headersJson: stringifyJsonField(provider.config?.headers),
      generationConfigJson: stringifyJsonField(provider.config?.generationConfig),
      anthropicVersion: provider.config?.anthropicVersion || '2023-06-01',
      temperature: provider.config?.temperature ?? 0.2,
      maxTokens: provider.config?.maxTokens ?? 2048,
      inputPerMillion: provider.config?.pricing?.inputPerMillion || 0,
      outputPerMillion: provider.config?.pricing?.outputPerMillion || 0,
      spentUsd: provider.quota?.spentUsd || 0,
      balanceUsd: provider.quota?.balanceUsd,
      remainingUsd: provider.quota?.remainingUsd,
    });
    setProviderModalOpen(true);
  };

  const openCreateProxy = () => {
    setEditingProxy(null);
    proxyForm.setFieldsValue({ enabled: true });
    setProxyModalOpen(true);
  };

  const openEditProxy = (proxy) => {
    setEditingProxy(proxy);
    proxyForm.setFieldsValue({
      name: proxy.name,
      enabled: proxy.enabled,
      url: proxy.config?.url || '',
      noProxy: proxy.config?.noProxy || '',
    });
    setProxyModalOpen(true);
  };

  const handleStartEditGlobalProxy = () => {
    setGlobalProxyAddressDraft(globalProxy?.config?.url || '');
    setGlobalProxyEditing(true);
  };

  const handleSaveGlobalProxyAddress = async () => {
    const nextUrl = String(globalProxyAddressDraft || '').trim();
    if (!nextUrl) {
      messageApi.error('请输入全局代理地址');
      return;
    }
    setSaving(true);
    try {
      if (globalProxy) {
        await window.developerBox.saveProxy({
          ...globalProxy,
          config: {
            ...(globalProxy.config || {}),
            url: nextUrl,
            isGlobal: true,
          },
        });
      } else {
        await window.developerBox.saveProxy({
          name: '全局代理',
          enabled: true,
          config: {
            url: nextUrl,
            noProxy: '',
            isGlobal: true,
          },
        });
      }
      messageApi.success('全局代理已更新');
      setGlobalProxyEditing(false);
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const handleClearGlobalProxy = async () => {
    if (!globalProxyId) return;
    const current = proxies.find((item) => item.id === globalProxyId);
    if (!current) return;
    setSaving(true);
    try {
      await window.developerBox.saveProxy({
        ...current,
        config: {
          ...(current.config || {}),
          isGlobal: false,
        },
      });
      messageApi.success('已清除全局代理');
      setGlobalProxyEditing(false);
      setGlobalProxyAddressDraft('');
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const openProviderModels = (provider) => {
    const modelIds = (provider.runtime?.models || [])
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter(Boolean);
    setEditingModelsProvider(provider);
    setProviderModelItems(Array.from(new Set(modelIds)));
    setProviderModelInput('');
    setProviderModelsModalOpen(true);
  };

  const addProviderModelItem = () => {
    const next = String(providerModelInput || '').trim();
    if (!next) return;
    if (!providerModelItems.includes(next)) {
      setProviderModelItems((current) => [...current, next]);
    }
    setProviderModelInput('');
  };

  const removeProviderModelItem = (target) => {
    setProviderModelItems((current) => current.filter((item) => item !== target));
  };

  const saveProviderModels = async () => {
    if (!editingModelsProvider) return;
    setSaving(true);
    try {
      const nextRuntime = {
        ...(editingModelsProvider.runtime || {}),
        models: providerModelItems.map((item) => ({ id: item, label: item })),
      };
      await window.developerBox.saveProvider({
        ...editingModelsProvider,
        runtime: nextRuntime,
      });
      messageApi.success('模型列表已保存');
      setProviderModelsModalOpen(false);
      setEditingModelsProvider(null);
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const getTaskDraft = () => {
    try {
      const raw = localStorage.getItem(TASK_DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? data : null;
    } catch {
      return null;
    }
  };

  const setTaskDraft = (values) => {
    try {
      localStorage.setItem(TASK_DRAFT_STORAGE_KEY, JSON.stringify(values || {}));
    } catch {}
  };

  const clearTaskDraft = () => {
    try {
      localStorage.removeItem(TASK_DRAFT_STORAGE_KEY);
    } catch {}
  };

  const buildDefaultTaskValues = () => {
    const defaultProviderId = providers.find((item) => item.enabled)?.id || providers[0]?.id;
    return {
      mode: 'parallel',
      autoStart: true,
      orchestratorProviderId: defaultProviderId,
      steps: [{ name: 'leader', role: 'planner' }],
    };
  };

  const openCreateTaskModal = () => {
    setEditingTaskId('');
    const defaults = buildDefaultTaskValues();
    const draft = getTaskDraft();
    if (draft && hasTaskDraftContent(draft)) {
      setPendingDraft({ defaults, draft });
      setDraftPromptOpen(true);
      return;
    }
    taskForm.resetFields();
    setOrchestrationSummary('');
    taskForm.setFieldsValue(defaults);
    setTaskModalOpen(true);
  };

  const fillTaskFormFromDetail = (detail) => {
    const defaults = buildDefaultTaskValues();
    const agentIndexMap = new Map(detail.agents.map((agent, index) => [agent.id, index]));
    const steps = detail.agents.map((agent) => ({
      name: agent.name,
      providerId: agent.providerId,
      role: agent.role,
      model: agent.model || '',
      instructions: agent.instructions || '',
      dependsOn: (agent.dependsOn || [])
        .map((id) => agentIndexMap.get(id))
        .filter((idx) => Number.isInteger(idx)),
    }));
    taskForm.resetFields();
    setOrchestrationSummary('');
    taskForm.setFieldsValue({
      ...defaults,
      title: detail.task.title,
      goal: detail.task.goal,
      workingDirectory: detail.task.workingDirectory,
      mode: detail.task.orchestration?.mode || defaults.mode,
      orchestratorProviderId: detail.task.orchestration?.providerId || defaults.orchestratorProviderId,
      orchestratorModel: detail.task.orchestration?.model || '',
      autoStart: false,
      steps,
    });
  };

  const openEditTaskModal = async (task) => {
    if (!(task.status === 'queued' || task.status === 'failed' || task.status === 'cancelled')) return;
    const detail = await window.developerBox.getWorkspaceTaskDetail(task.id);
    if (!detail) {
      messageApi.error('任务不存在或已删除');
      return;
    }
    setEditingTaskId(task.id);
    fillTaskFormFromDetail(detail);
    setTaskModalOpen(true);
  };

  const handleCopyTask = async (task) => {
    const detail = await window.developerBox.getWorkspaceTaskDetail(task.id);
    if (!detail) {
      messageApi.error('任务不存在或已删除');
      return;
    }
    setEditingTaskId('');
    fillTaskFormFromDetail(detail);
    setTaskModalOpen(true);
  };

  const handleTaskModalCancel = () => {
    const values = taskForm.getFieldsValue(true);
    if (!hasTaskDraftContent(values)) {
      setTaskModalOpen(false);
      setEditingTaskId('');
      return;
    }
    modal.confirm({
      title: '检测到未保存的任务输入',
      content: '是否暂存当前输入，下次新建任务时可恢复？',
      okText: '暂存并关闭',
      cancelText: '直接关闭',
      onOk: () => {
        setTaskDraft({ ...values, orchestrationSummary });
        setTaskModalOpen(false);
        setEditingTaskId('');
      },
      onCancel: () => {
        setTaskModalOpen(false);
        setEditingTaskId('');
      },
    });
  };

  const handleSaveProvider = async () => {
    const values = await providerForm.validateFields();
    setSaving(true);
    try {
      await window.developerBox.saveProvider(normalizeProviderForm(values, editingProvider));
      messageApi.success('Provider 已保存');
      setProviderModalOpen(false);
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProxy = async () => {
    const values = await proxyForm.validateFields();
    setSaving(true);
    try {
      await window.developerBox.saveProxy(normalizeProxyForm(values, editingProxy));
      messageApi.success('代理已保存');
      setProxyModalOpen(false);
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    const values = await taskForm.validateFields();
    const payload = normalizeTaskForm(values);
    setSaving(true);
    try {
      if (editingTaskId) {
        const resp = await window.developerBox.resetWorkspaceTask({ taskId: editingTaskId, ...payload });
        if (!resp?.ok) {
          throw new Error(resp?.message || '编辑任务失败');
        }
        messageApi.success('任务已更新');
        clearTaskDraft();
        setOrchestrationSummary('');
        setTaskModalOpen(false);
        setSelectedTaskId(editingTaskId);
        setEditingTaskId('');
        await refreshWorkspace(editingTaskId);
      } else {
        const detail = await window.developerBox.createWorkspaceTask(payload);
        messageApi.success('任务已创建');
        clearTaskDraft();
        setOrchestrationSummary('');
        setTaskModalOpen(false);
        setSelectedTaskId(detail.task.id);
        if (payload.autoStart) {
          await window.developerBox.startWorkspaceTask(detail.task.id);
        }
        await refreshWorkspace(detail.task.id);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleChooseWorkingDirectory = async () => {
    try {
      const currentPath = taskForm.getFieldValue('workingDirectory') || '';
      const selected = await window.developerBox.chooseDirectory({
        title: '选择编排任务工作目录',
        defaultPath: currentPath || undefined,
      });
      if (selected) {
        taskForm.setFieldValue('workingDirectory', selected);
      }
    } catch (err) {
      messageApi.error('选择目录失败：' + (err?.message || err));
    }
  };

  const getTaskModalPopupContainer = (triggerNode) => triggerNode?.parentElement || document.body;

  const handleAutoOrchestrate = async () => {
    const currentSteps = taskForm.getFieldValue('steps') || [];
    const hasTaskDraftContent = !(
      Array.isArray(currentSteps) && currentSteps.length === 1 &&
      String(currentSteps[0].name || '').trim() === 'leader' && String(currentSteps[0].role || '').trim() === 'planner' &&
      String(currentSteps[0].instructions || '').trim() === ''
    ) && (Array.isArray(currentSteps) && currentSteps.length > 0);
    if (hasTaskDraftContent) {
      const confirmed = await new Promise((resolve) => {
        modal.confirm({
          title: '重新生成步骤',
          content: `当前已有 ${currentSteps.length} 个 Agent 步骤，重新生成会覆盖现有配置，是否继续？`,
          okText: '继续生成',
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }
    const values = await taskForm.validateFields(['title', 'goal', 'workingDirectory', 'orchestratorProviderId']);
    setOrchestrationLoading(true);
    try {
      const resp = await window.developerBox.autoOrchestrateWorkspaceTask({
        providerId: values.orchestratorProviderId,
        model: taskForm.getFieldValue('orchestratorModel') || '',
        title: values.title,
        goal: values.goal,
        workingDirectory: values.workingDirectory,
      });
      if (!resp?.ok) {
        const errMsg = String(resp?.message || '自动编排失败，请重试');
        // resp.raw from structured return; also try to extract [RAW] embedded in message (legacy/fallback)
        const rawInMsg = errMsg.includes('[RAW]\n')
          ? errMsg.split('[RAW]\n').slice(1).join('[RAW]\n').trim()
          : '';
        const errRaw = String(resp?.raw || rawInMsg || '');
        modal.error({
          title: 'AI 自动编排失败',
          width: 760,
          content: (
            <div>
              <Typography.Paragraph type="danger" style={{ marginBottom: 8 }}>
                {errMsg.split('\n[RAW]\n')[0]}
              </Typography.Paragraph>
              <Typography.Text type="secondary">返回内容</Typography.Text>
              <pre className="workspace-code-block" style={{ maxHeight: 300, marginTop: 8 }}>{errRaw || '(无返回内容)'}</pre>
            </div>
          ),
        });
        return;
      }
      const result = resp.data;
      taskForm.setFieldValue('steps', result.steps.map((step) => ({
        name: step.name,
        providerId: step.providerId,
        role: step.role,
        model: '',
        instructions: step.instructions,
        dependsOn: step.dependsOn,
        aiDescriptionCn: step.descriptionCn || '',
        aiOriginal: {
          name: step.name,
          providerId: step.providerId,
          role: step.role,
          model: '',
          instructions: step.instructions,
          dependsOn: step.dependsOn,
        },
      })));
      setOrchestrationSummary(result.summary || '');
      messageApi.success(`已生成 ${result.steps.length} 个 agent 步骤`);
    } catch (error) {
      const msg = String(error?.message || '自动编排失败，请重试');
      // Electron IPC serializes error.message but NOT custom props like error.raw.
      // The raw content is embedded in message as \n[RAW]\n... by autoOrchestrateTask.
      const rawInMsg = msg.includes('[RAW]\n')
        ? msg.split('[RAW]\n').slice(1).join('[RAW]\n').trim()
        : '';
      const errRaw = String(error?.raw || rawInMsg || '');
      modal.error({
        title: 'AI 自动编排失败',
        width: 760,
        content: (
          <div>
            <Typography.Paragraph type="danger" style={{ marginBottom: 8 }}>
              {msg.split('\n[RAW]\n')[0]}
            </Typography.Paragraph>
            <Typography.Text type="secondary">返回内容</Typography.Text>
            <pre className="workspace-code-block" style={{ maxHeight: 300, marginTop: 8 }}>{errRaw || '(无返回内容)'}</pre>
          </div>
        ),
      });
    } finally {
      setOrchestrationLoading(false);
    }
  };

  const handleRunTask = async (taskId) => {
    setSaving(true);
    try {
      await window.developerBox.startWorkspaceTask(taskId);
      await refreshWorkspace(taskId);
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshProvider = async (providerId) => {
    setSaving(true);
    try {
      await window.developerBox.refreshProvider(providerId);
      await refreshWorkspace(selectedTaskId);
    } finally {
      setSaving(false);
    }
  };

  const taskStats = overview?.stats || {
    providerCount: 0,
    runningCount: 0,
    queuedCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalSpentUsd: 0,
  };

  const providerKind = Form.useWatch('kind', providerForm);

  return (
    <section className="content-area workspace-page">
      <Flex justify="space-between" align="center" className="page-nav-row">
        <BreadcrumbNav items={[{ title: '首页', onClick: onBackHome }, { title: '工作区' }]} />
        <Flex gap={8}>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label="返回上一页" />
          <Button shape="circle" icon={<HomeOutlined />} onClick={onBackHome} aria-label="返回首页" />
        </Flex>
      </Flex>

      <div className="workspace-hero">
        <div>
          <Typography.Title level={3} className="workspace-title">Agent 工作区</Typography.Title>
          <Typography.Paragraph type="secondary" className="workspace-desc">
            统一管理本机 CLI、多模型 API、代理网络、任务编排和每个 agent 的输入输出轨迹。
          </Typography.Paragraph>
        </div>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            openCreateTaskModal();
          }}>
            新建任务
          </Button>
          <Button icon={<SettingOutlined />} onClick={() => { setProviderDrawerOpen(true); loadCommandAllowlist(); }}>
            Provider 与代理
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => refreshWorkspace(selectedTaskId)}>
            刷新
          </Button>
          {!onOpenTaskDetail && detailPageTaskId && (
            <Button onClick={() => setDetailPageTaskId('')}>返回任务中心</Button>
          )}
        </Space>
      </div>

      {loading ? (
        <Flex justify="center" align="center" className="workspace-loading"><Spin /></Flex>
      ) : (
        <>
          <div className="workspace-stat-grid">
            <Card className="tool-entry"><Statistic title="已接入 Provider" value={taskStats.providerCount} prefix={<DatabaseOutlined />} /></Card>
            <Card className="tool-entry"><Statistic title="运行中任务" value={taskStats.runningCount} prefix={<ThunderboltOutlined />} /></Card>
            <Card className="tool-entry"><Statistic title="排队任务" value={taskStats.queuedCount} prefix={<PauseCircleOutlined />} /></Card>
            <Card className="tool-entry"><Statistic title="完成任务" value={taskStats.completedCount} prefix={<RobotOutlined />} /></Card>
            <Card className="tool-entry"><Statistic title="累计消耗 USD" value={formatMoney(taskStats.totalSpentUsd)} prefix={<ApiOutlined />} /></Card>
          </div>

          <div className="workspace-layout">
            {!detailPageTaskId && (
              <Card className="tool-entry workspace-sidebar" title="任务中心" extra={<Tag color="blue">{tasks.length} 条</Tag>}>
              <List
                dataSource={tasks}
                locale={{ emptyText: <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                renderItem={(task) => (
                  <List.Item className={`workspace-task-item${selectedTaskId === task.id ? ' active' : ''}`} onClick={() => {
                    setSelectedTaskId(task.id);
                    if (onOpenTaskDetail) {
                      onOpenTaskDetail(task.id);
                    } else {
                      setDetailPageTaskId(task.id);
                      loadTaskDetail(task.id, tasks);
                    }
                  }}>
                    <div className="workspace-task-card">
                      <Flex justify="space-between" align="start" gap={8}>
                        <div>
                          <Typography.Text strong>{task.title}</Typography.Text>
                          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 0, marginTop: 6 }}>
                            {task.goal}
                          </Typography.Paragraph>
                        </div>
                        <Tag color={TASK_STATUS_COLOR[task.status] || 'default'}>{task.status}</Tag>
                      </Flex>
                      <Flex justify="space-between" align="center" style={{ marginTop: 10 }}>
                        <Typography.Text type="secondary">{formatTime(task.updatedAt)}</Typography.Text>
                        <Space size={4}>
                          {(task.status === 'queued' || task.status === 'failed' || task.status === 'cancelled') && (
                            <Button
                              size="small"
                              type="text"
                              icon={<EditOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditTaskModal(task);
                              }}
                            />
                          )}
                          <Button
                            size="small"
                            type="text"
                            icon={<CopyOutlined />}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCopyTask(task);
                            }}
                          />
                          {(task.status === 'queued' || task.status === 'failed' || task.status === 'cancelled') && (
                            <Button size="small" type="text" icon={<CaretRightOutlined />} onClick={(event) => {
                              event.stopPropagation();
                              handleRunTask(task.id);
                            }} />
                          )}
                          {task.status === 'running' && (
                            <Button size="small" type="text" danger icon={<PauseCircleOutlined />} onClick={(event) => {
                              event.stopPropagation();
                              window.developerBox.cancelWorkspaceTask(task.id);
                            }} />
                          )}
                          <Popconfirm title="确认删除该任务？" onConfirm={(event) => {
                            event?.stopPropagation?.();
                            return window.developerBox.deleteWorkspaceTask(task.id).then(() => refreshWorkspace(selectedTaskId === task.id ? '' : selectedTaskId));
                          }}>
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()} />
                          </Popconfirm>
                        </Space>
                      </Flex>
                    </div>
                  </List.Item>
                )}
              />
              </Card>
            )}
          </div>
        </>
      )}

      <Drawer
        title="Provider / 代理管理"
        open={providerDrawerOpen}
        onClose={() => setProviderDrawerOpen(false)}
        width={760}
        styles={{
          mask: {
            top: 'var(--titlebar-height)',
            height: 'calc(100% - var(--titlebar-height))',
          },
          wrapper: {
            top: 'var(--titlebar-height)',
            height: 'calc(100% - var(--titlebar-height))',
          },
        }}
        extra={<Space><Button icon={<PlusOutlined />} onClick={openCreateProvider}>新增 Provider</Button><Button icon={<LinkOutlined />} onClick={openCreateProxy}>新增代理</Button></Space>}
      >
        <Tabs
          items={[
            {
              key: 'providers',
              label: 'Providers',
              children: (
                <div className="workspace-provider-list">
                  {providers.map((provider) => (
                    <Card
                      key={provider.id}
                      className="tool-entry workspace-provider-card"
                      title={<Space><span>{provider.name}</span><Tag color={provider.enabled ? 'green' : 'default'}>{provider.kind}</Tag></Space>}
                      extra={<Space><Button size="small" icon={<ReloadOutlined />} onClick={() => handleRefreshProvider(provider.id)} /><Button size="small" onClick={() => openProviderModels(provider)}>模型列表</Button><Button size="small" onClick={() => openEditProvider(provider)}>编辑</Button><Popconfirm title="确认删除该 Provider？" onConfirm={() => window.developerBox.deleteProvider(provider.id).then(() => refreshWorkspace(selectedTaskId))}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>}
                    >
                      <Descriptions size="small" column={2}>
                        <Descriptions.Item label="可用性">{provider.runtime?.available ? '可用' : '未检测/不可用'}</Descriptions.Item>
                        <Descriptions.Item label="最近检测">{formatTime(provider.runtime?.lastCheckedAt)}</Descriptions.Item>
                        <Descriptions.Item label="累计花费">${formatMoney(provider.stats?.spentUsd || provider.quota?.spentUsd)}</Descriptions.Item>
                        <Descriptions.Item label="剩余额度">{provider.quota?.remainingUsd ?? provider.quota?.balanceUsd ?? '-'}</Descriptions.Item>
                        <Descriptions.Item label="模型数量">{provider.runtime?.models?.length ?? 0}</Descriptions.Item>
                        <Descriptions.Item label="模型接口">{provider.runtime?.modelsError ? `失败: ${provider.runtime.modelsError}` : '正常'}</Descriptions.Item>
                      </Descriptions>
                      {provider.config?.notes && <Alert style={{ marginTop: 12 }} type="info" message={provider.config.notes} showIcon />}
                    </Card>
                  ))}
                </div>
              ),
            },
            {
              key: 'proxies',
              label: '网络代理',
              children: (
                <div className="workspace-provider-list">
                  <Card className="tool-entry workspace-provider-card" title="全局代理">
                    {!globalProxyEditing ? (
                      <Flex align="center" justify="space-between" gap={12}>
                        <Typography.Text copyable={!!globalProxy?.config?.url}>{globalProxy?.config?.url || '-'}</Typography.Text>
                        <Button onClick={handleStartEditGlobalProxy}>修改</Button>
                      </Flex>
                    ) : (
                      <Space.Compact style={{ width: '100%' }}>
                        <Input
                          placeholder="输入全局代理地址，如 http://127.0.0.1:7890"
                          value={globalProxyAddressDraft}
                          onChange={(event) => setGlobalProxyAddressDraft(event.target.value)}
                        />
                        <Button type="primary" onClick={handleSaveGlobalProxyAddress}>确定</Button>
                        <Button danger onClick={handleClearGlobalProxy}>清除</Button>
                        <Button onClick={() => { setGlobalProxyEditing(false); setGlobalProxyAddressDraft(''); }}>取消</Button>
                      </Space.Compact>
                    )}
                  </Card>
                  {proxies.length === 0 ? <Empty description="暂无代理配置" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : proxies.map((proxy) => (
                    <Card
                      key={proxy.id}
                      className="tool-entry workspace-provider-card"
                      title={<Space><span>{proxy.name}</span><Tag color={proxy.enabled ? 'blue' : 'default'}>{proxy.enabled ? '启用' : '禁用'}</Tag></Space>}
                      extra={<Space><Button size="small" onClick={() => openEditProxy(proxy)}>编辑</Button><Popconfirm title="确认删除该代理？" onConfirm={() => window.developerBox.deleteProxy(proxy.id).then(() => refreshWorkspace(selectedTaskId))}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>}
                    >
                      <Descriptions size="small" column={1}>
                        <Descriptions.Item label="地址">{proxy.config?.url}</Descriptions.Item>
                        <Descriptions.Item label="NO_PROXY">{proxy.config?.noProxy || '-'}</Descriptions.Item>
                        <Descriptions.Item label="全局代理">{proxy.config?.isGlobal ? '是' : '否'}</Descriptions.Item>
                      </Descriptions>
                    </Card>
                  ))}
                </div>
              ),
            },
            {
              key: 'allowlist',
              label: '命令白名单',
              children: (
                <div className="workspace-provider-list">
                  <Card className="tool-entry workspace-provider-card" title="全局命令白名单" loading={commandAllowlistLoading}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Alert
                        type="info"
                        showIcon
                        message="每行一条规则。支持完整命令或命令前缀；运行命令时按“完全相等”或“前缀+空格”匹配。"
                      />
                      <Input.TextArea
                        rows={12}
                        value={commandAllowlistText}
                        onChange={(event) => setCommandAllowlistText(event.target.value)}
                        placeholder={['pnpm', 'npm', 'node', 'git status', 'git diff'].join('\n')}
                      />
                      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
                        <Typography.Text type="secondary">当前生效：{commandAllowlist.length} 条</Typography.Text>
                        <Space>
                          <Button onClick={loadCommandAllowlist} loading={commandAllowlistLoading}>刷新</Button>
                          <Button type="primary" onClick={handleSaveCommandAllowlist} loading={saving}>保存白名单</Button>
                        </Space>
                      </Flex>
                    </Space>
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Drawer>

      <Modal title={editingProvider ? '编辑 Provider' : '新增 Provider'} open={providerModalOpen} onCancel={() => setProviderModalOpen(false)} onOk={handleSaveProvider} confirmLoading={saving} width={760} destroyOnHidden>
        <Form form={providerForm} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col span={4}><Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item></Col>
            <Col span={8}><Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input /></Form.Item></Col>
            <Col span={6}><Form.Item name="kind" label="类型" rules={[{ required: true, message: '请选择类型' }]}><Select options={PROVIDER_KIND_OPTIONS} /></Form.Item></Col>
            <Col span={6}><Form.Item name="proxyId" label="代理策略"><Select options={[{ label: '使用全局代理', value: '' }, { label: '不使用代理', value: '__none__' }, ...proxies.map((proxy) => ({ label: proxy.name, value: proxy.id }))]} /></Form.Item></Col>
          </Row>

          {providerKind === 'cli' ? (
            <>
              <Row gutter={[16, 0]}>
                <Col span={8}><Form.Item name="binary" label="主命令"><Input placeholder="claude" /></Form.Item></Col>
                <Col span={8}><Form.Item name="promptMode" label="Prompt 传递方式"><Select options={[{ label: '参数', value: 'argv' }, { label: 'stdin', value: 'stdin' }]} /></Form.Item></Col>
                <Col span={8}><Form.Item name="quotaCommand" label="额度查询命令"><Input placeholder="输出 JSON 或文本，可留空" /></Form.Item></Col>
              </Row>
              <Form.Item name="binaryCandidates" label="候选命令（每行一个）"><TextArea rows={3} placeholder={'claude\ngemini'} /></Form.Item>
              <Form.Item name="argsTemplate" label="参数模板（每行一个，支持 {{prompt}} / {{model}}）"><TextArea rows={4} placeholder={'-p\n{{prompt}}'} /></Form.Item>
              <Form.Item name="shellTemplate" label="Shell 模板（可选，优先于参数模板）"><Input placeholder={'my-cli --model {{model}} "{{prompt}}"'} /></Form.Item>
              <Form.Item name="envJson" label="环境变量 JSON"><TextArea rows={4} placeholder='{"FOO":"bar"}' /></Form.Item>
              <Form.Item name="notes" label="备注"><TextArea rows={3} /></Form.Item>
            </>
          ) : (
            <>
              <Row gutter={[16, 0]}>
                <Col span={12}><Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入 Base URL' }]}><Input placeholder="https://api.openai.com/v1" /></Form.Item></Col>
                <Col span={12}><Form.Item name="model" label="默认模型" rules={[{ required: true, message: '请输入模型名称' }]}><Input placeholder="gpt-5.4 / claude-sonnet / gemini-2.5-pro" /></Form.Item></Col>
              </Row>
              <Row gutter={[16, 0]}>
                <Col span={12}><Form.Item name="apiKey" label="API Key" rules={[{ required: true, message: '请输入 API Key' }]}><Input.Password placeholder="sk-..." /></Form.Item></Col>
                {providerKind === 'anthropic' && <Col span={12}><Form.Item name="anthropicVersion" label="Anthropic Version"><Input /></Form.Item></Col>}
              </Row>
              <Row gutter={[16, 0]}>
                <Col span={12}><Form.Item name="temperature" label="Temperature"><InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={12}><Form.Item name="maxTokens" label="Max Tokens"><InputNumber min={1} max={65536} style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Form.Item name="headersJson" label="附加请求头 JSON"><TextArea rows={4} placeholder='{"x-foo":"bar"}' /></Form.Item>
              {providerKind === 'gemini' && <Form.Item name="generationConfigJson" label="Gemini Generation Config JSON"><TextArea rows={4} placeholder='{"candidateCount":1}' /></Form.Item>}
            </>
          )}

          <Divider />
          <Typography.Text strong>额度与成本</Typography.Text>
          <Row gutter={[16, 0]} style={{ marginTop: 12 }}>
            <Col span={8}><Form.Item name="inputPerMillion" label="输入单价 / 1M Tokens USD"><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="outputPerMillion" label="输出单价 / 1M Tokens USD"><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="spentUsd" label="已消耗 USD"><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="balanceUsd" label="总额度 USD"><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="remainingUsd" label="剩余额度 USD"><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={editingProxy ? '编辑代理' : '新增代理'} open={proxyModalOpen} onCancel={() => setProxyModalOpen(false)} onOk={handleSaveProxy} confirmLoading={saving} destroyOnHidden>
        <Form form={proxyForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入代理名称' }]}><Input /></Form.Item>
          <Form.Item name="url" label="代理地址" rules={[{ required: true, message: '请输入代理地址' }]}><Input placeholder="http://127.0.0.1:7890" /></Form.Item>
          <Form.Item name="noProxy" label="NO_PROXY"><Input placeholder="localhost,127.0.0.1" /></Form.Item>
          <div className="workspace-form-grid">
            <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal title={editingTaskId ? '编辑编排任务' : '新建编排任务'} open={taskModalOpen} onCancel={orchestrationLoading ? undefined : handleTaskModalCancel} closable={!orchestrationLoading} maskClosable={!orchestrationLoading} keyboard={!orchestrationLoading} onOk={handleCreateTask} confirmLoading={saving} width={920} destroyOnHidden>
        <Form form={taskForm} layout="vertical">
          <div className="workspace-form-grid workspace-form-grid--wide">
            <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}><Input placeholder="例如：为新版设置中心设计并实现 agent 工作流" /></Form.Item>
            <Form.Item name="workingDirectory" label="工作目录" rules={[{ required: true, message: '请选择工作目录' }]}>
              <Input
                placeholder="请选择或输入任务执行工作目录"
                style={{ cursor: 'text' }}
                suffix={<FolderOpenOutlined style={{ cursor: 'pointer', color: '#1677ff' }} onClick={e => { e.stopPropagation(); handleChooseWorkingDirectory(); }} />}
              />
            </Form.Item>
            <Form.Item name="mode" label="编排模式"><Select getPopupContainer={getTaskModalPopupContainer} options={[{ label: '并行优先', value: 'parallel' }, { label: '按依赖推进', value: 'dependency' }]} /></Form.Item>
            <Form.Item name="autoStart" label="创建后立即执行" valuePropName="checked"><Switch /></Form.Item>
          </div>
          <Form.Item name="goal" label="任务目标" rules={[{ required: true, message: '请输入任务目标' }]}><TextArea rows={4} placeholder="描述需要多个 agent 协作完成的目标、约束和预期产出。" /></Form.Item>
          <Divider />
          <Typography.Text strong>AI 自动编排</Typography.Text>
          <div className="workspace-form-grid workspace-form-grid--wide" style={{ marginTop: 12 }}>
            <Form.Item name="orchestratorProviderId" label="编排 Provider" rules={[{ required: true, message: '请选择编排 Provider' }]}>
              <Select
                getPopupContainer={getTaskModalPopupContainer}
                onChange={() => taskForm.setFieldValue('orchestratorModel', undefined)}
                options={providers.filter((item) => item.enabled !== false).map((provider) => ({
                  label: provider.name,
                  value: provider.id,
                }))}
                placeholder="选择用于自动编排的 Provider"
              />
            </Form.Item>
            <Form.Item name="orchestratorModel" label="编排模型（可选）">
              <Select
                getPopupContainer={getTaskModalPopupContainer}
                allowClear
                showSearch
                options={orchestratorModels}
                placeholder={orchestratorModels.length ? '选择模型' : '先刷新 Provider 模型列表'}
              />
            </Form.Item>
          </div>
          <Button loading={orchestrationLoading} icon={<RobotOutlined />} onClick={handleAutoOrchestrate}>
            生成 Agent 步骤
          </Button>
          {orchestrationSummary && <Alert style={{ marginTop: 12 }} type="success" showIcon title={`AI 摘要：${orchestrationSummary}`} />}
          <Divider />
          <Typography.Text strong>Agent 步骤</Typography.Text>
          <Form.List name="steps" rules={[{ validator: async (_, value) => {
            if (!value || value.length === 0) throw new Error('至少添加一个 agent 步骤');
          } }]}>
            {(fields, { add, remove }) => (
              <div className="workspace-step-list">
                {fields.map((field, index) => {
                  const steps = watchedSteps;
                  return (
                    <Card
                      key={field.key}
                      className="tool-entry workspace-step-card"
                      title={`Agent ${index + 1}`}
                      extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />}
                    >
                      {!isAiStepModified(steps[field.name]) && steps[field.name]?.aiDescriptionCn && (
                        <Alert style={{ marginBottom: 12 }} type="info" showIcon message={`中文说明：${steps[field.name].aiDescriptionCn}`} />
                      )}
                      <div className="workspace-form-grid workspace-form-grid--wide">
                        <Form.Item name={[field.name, 'name']} label="名称" rules={[{ required: true, message: '请输入 agent 名称' }]}><Input placeholder="planner / executor / reviewer" /></Form.Item>
                        <Form.Item name={[field.name, 'providerId']} label="Provider" rules={[{ required: true, message: '请选择 Provider' }]}><Select getPopupContainer={getTaskModalPopupContainer} options={providers.map((provider) => ({ label: provider.name, value: provider.id }))} /></Form.Item>
                        <Form.Item name={[field.name, 'role']} label="角色"><Select getPopupContainer={getTaskModalPopupContainer} allowClear options={ROLE_OPTIONS} /></Form.Item>
                        <Form.Item shouldUpdate noStyle>
                          {() => {
                            const selectedProviderId = taskForm.getFieldValue(['steps', field.name, 'providerId']);
                            const provider = providers.find((item) => item.id === selectedProviderId);
                            const modelOptions = provider?.runtime?.models?.length
                              ? provider.runtime.models.map((item) => ({ label: item.label || item.id, value: item.id }))
                              : (provider?.config?.model ? [{ label: provider.config.model, value: provider.config.model }] : []);
                            return (
                              <Form.Item name={[field.name, 'model']} label="模型覆盖">
                                <Select
                                  getPopupContainer={getTaskModalPopupContainer}
                                  allowClear
                                  showSearch
                                  options={modelOptions}
                                  placeholder={selectedProviderId ? (modelOptions.length ? '选择模型' : '先刷新该 Provider 模型列表') : '先选择 Provider'}
                                />
                              </Form.Item>
                            );
                          }}
                        </Form.Item>
                      </div>
                      <Form.Item name={[field.name, 'instructions']} label="Agent 指令"><TextArea rows={3} placeholder="告诉当前 agent 的职责、输出格式和约束。" /></Form.Item>
                      <Form.Item name={[field.name, 'dependsOn']} label="依赖步骤（按字段索引绑定）">
                        <Select
                          getPopupContainer={getTaskModalPopupContainer}
                          mode="multiple"
                          allowClear
                          options={fields
                            .filter((candidateField) => candidateField.key !== field.key)
                            .map((candidateField) => ({
                              label: steps[candidateField.name]?.name || `步骤 ${candidateField.name + 1}`,
                              value: candidateField.name,
                            }))}
                        />
                      </Form.Item>
                    </Card>
                  );
                })}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ role: 'executor' })}>添加 Agent</Button>
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>

      <Modal
        title={editingModelsProvider ? `模型列表 - ${editingModelsProvider.name}` : '模型列表'}
        open={providerModelsModalOpen}
        onCancel={() => setProviderModelsModalOpen(false)}
        onOk={saveProviderModels}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
          <Input
            placeholder="输入模型 ID，例如 gpt-5.4"
            value={providerModelInput}
            onChange={(event) => setProviderModelInput(event.target.value)}
            onPressEnter={addProviderModelItem}
          />
          <Button type="primary" onClick={addProviderModelItem}>添加</Button>
        </Space.Compact>
        <List
          bordered
          dataSource={providerModelItems}
          locale={{ emptyText: '暂无模型，可手动添加' }}
          renderItem={(item) => (
            <List.Item
              actions={[<Button key="delete" type="link" danger onClick={() => removeProviderModelItem(item)}>删除</Button>]}
            >
              {item}
            </List.Item>
          )}
        />
      </Modal>

      <Modal
        title="检测到任务暂存数据"
        open={draftPromptOpen}
        onCancel={() => {
          setDraftPromptOpen(false);
          setPendingDraft(null);
        }}
        footer={[
          <Button key="delete" danger onClick={() => {
            clearTaskDraft();
            setDraftPromptOpen(false);
            if (pendingDraft?.defaults) {
              setOrchestrationSummary('');
              taskForm.setFieldsValue(pendingDraft.defaults);
              setTaskModalOpen(true);
            }
            setPendingDraft(null);
          }}>
            删除暂存数据
          </Button>,
          <Button key="cancel" onClick={() => {
            setDraftPromptOpen(false);
            setPendingDraft(null);
          }}>
            取消
          </Button>,
          <Button key="restore" type="primary" onClick={() => {
            const defaults = pendingDraft?.defaults || {};
            const draft = pendingDraft?.draft || {};
            taskForm.resetFields();
            setOrchestrationSummary(String(draft.orchestrationSummary || ''));
            taskForm.setFieldsValue({ ...defaults, ...draft });
            setDraftPromptOpen(false);
            setPendingDraft(null);
            setTaskModalOpen(true);
          }}>
            恢复
          </Button>,
        ]}
        destroyOnHidden
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          你上次新建任务时有未提交内容，是否恢复？
        </Typography.Paragraph>
      </Modal>
    </section>
  );
}