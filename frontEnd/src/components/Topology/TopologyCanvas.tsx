import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Edge,
  type Node,
  type NodeTypes,
  useReactFlow,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";

import DeviceNode, { type DeviceNodeData } from "./DeviceNode";
import StatusPill from "./StatusPill";
import Modal from "@/components/ui/Modal";
import Toast from "@/components/ui/Toast";

import {
  fetchTopology,
  patchDevicePosition,
  patchDeviceStatus,
  patchLinkStatus,
  createDevice,
  createLink,
  deleteDevice,
  deleteLink,
  type DeviceStatus,
  type DeviceType,
  type LinkStatus,
  type TopologyEdge,
} from "@/api/topology";

const nodeTypes: NodeTypes = { device: DeviceNode };

type EdgeData = { status?: LinkStatus };
type FlowNode = Node<DeviceNodeData>;
type FlowEdge = Edge<EdgeData>;

function edgeColor(status: LinkStatus) {
  if (status === "up") return "#22c55e";
  if (status === "warn") return "#f59e0b";
  return "#ef4444";
}

function toFlowEdge(e: TopologyEdge): FlowEdge {
  const status = (e.data?.status ?? "up") as LinkStatus;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    data: { status },
    type: "smoothstep",
    animated: status !== "up",
    style: { stroke: edgeColor(status), strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed },
  };
}

function layoutWithDagre(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: "TB" | "LR" = "TB"
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 80, nodesep: 55 });

  nodes.forEach((n) => g.setNode(n.id, { width: 220, height: 70 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id) as { x: number; y: number };
    return {
      ...n,
      position: { x: p.x - 110, y: p.y - 35 },
    };
  });
}

export default function TopologyCanvas() {
  const rf = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<DeviceNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // modais
  const [openAddDevice, setOpenAddDevice] = useState<boolean>(false);
  const [openAddLink, setOpenAddLink] = useState<boolean>(false);
  const [openConfirmDelete, setOpenConfirmDelete] = useState<boolean>(false);

  // form device
  const [devName, setDevName] = useState<string>("");
  const [devType, setDevType] = useState<DeviceType>("switch");
  const [devIp, setDevIp] = useState<string>("");

  // form link
  const [linkFrom, setLinkFrom] = useState<string>("");
  const [linkTo, setLinkTo] = useState<string>("");
  const [linkLabel, setLinkLabel] = useState<string>("");

  // search
  const [query, setQuery] = useState<string>("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const topo = await fetchTopology();

      const rfNodes: FlowNode[] = topo.nodes.map((n) => ({
        id: n.id,
        type: "device",
        position: n.position,
        data: n.data,
      }));

      const rfEdges: FlowEdge[] = topo.edges.map((e) => toFlowEdge(e));

      setNodes(rfNodes);
      setEdges(rfEdges);

      setLinkFrom(rfNodes[0]?.id ?? "");
      setLinkTo(rfNodes[1]?.id ?? "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`Erro ao carregar: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // dragStop salva posição
  const onNodeDragStop = useCallback(
    async (_event: unknown, node: FlowNode) => {
      try {
        await patchDevicePosition(node.id, node.position.x, node.position.y);
        showToast("Posição salva ✅");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        showToast(`Falha ao salvar posição: ${msg}`);
      }
    },
    [showToast]
  );

  const onSelectionChange = useCallback((params: { nodes: FlowNode[]; edges: FlowEdge[] }) => {
    setSelectedNodeId(params.nodes?.[0]?.id ?? null);
    setSelectedEdgeId(params.edges?.[0]?.id ?? null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const selectedEdge = useMemo(
    () => edges.find((e) => e.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  );

  // status
  const changeNodeStatus = useCallback(
    async (status: DeviceStatus) => {
      if (!selectedNode) return;
      try {
        await patchDeviceStatus(selectedNode.id, status);
        setNodes((prev) =>
          prev.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, status } } : n))
        );
        showToast("Status do equipamento atualizado ✅");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        showToast(`Falha ao atualizar: ${msg}`);
      }
    },
    [selectedNode, showToast]
  );

  const changeEdgeStatus = useCallback(
    async (status: LinkStatus) => {
      if (!selectedEdge) return;
      try {
        await patchLinkStatus(selectedEdge.id, status);
        setEdges((prev) =>
          prev.map((e) => {
            if (e.id !== selectedEdge.id) return e;
            return {
              ...e,
              data: { ...(e.data ?? {}), status },
              animated: status !== "up",
              style: { ...(e.style ?? {}), stroke: edgeColor(status), strokeWidth: 2 },
            };
          })
        );
        showToast("Status do link atualizado ✅");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "unknown";
        showToast(`Falha ao atualizar link: ${msg}`);
      }
    },
    [selectedEdge, showToast]
  );

  // criar device
  const submitCreateDevice = useCallback(async () => {
    if (devName.trim().length < 2) return showToast("Nome muito curto.");

    try {
      const center = rf.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });

      await createDevice({
        name: devName.trim(),
        type: devType,
        ip: devIp.trim() ? devIp.trim() : undefined,
        status: "up",
        x: center.x,
        y: center.y,
      });

      setOpenAddDevice(false);
      setDevName("");
      setDevIp("");
      showToast("Equipamento criado ✅");
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`Erro ao criar: ${msg}`);
    }
  }, [devName, devType, devIp, rf, load, showToast]);

  // criar link
  const submitCreateLink = useCallback(async () => {
    if (!linkFrom || !linkTo) return showToast("Selecione origem e destino.");
    if (linkFrom === linkTo) return showToast("Origem e destino não podem ser iguais.");

    try {
      await createLink({
        fromId: linkFrom,
        toId: linkTo,
        label: linkLabel.trim() ? linkLabel.trim() : undefined,
        status: "up",
      });

      setOpenAddLink(false);
      setLinkLabel("");
      showToast("Link criado ✅");
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`Erro ao conectar: ${msg}`);
    }
  }, [linkFrom, linkTo, linkLabel, load, showToast]);

  // deletar selecionado
  const confirmDelete = useCallback(async () => {
    try {
      if (selectedNode) {
        await deleteDevice(selectedNode.id);
        showToast("Equipamento deletado ✅");
      } else if (selectedEdge) {
        await deleteLink(selectedEdge.id);
        showToast("Link deletado ✅");
      } else {
        showToast("Nada selecionado.");
      }

      setOpenConfirmDelete(false);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`Erro ao deletar: ${msg}`);
    }
  }, [selectedNode, selectedEdge, load, showToast]);

  // search results
  const filteredNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return nodes.filter((n) => {
      const name = n.data.name.toLowerCase();
      const ip = (n.data.ip ?? "").toLowerCase();
      const type = n.data.type.toLowerCase();
      return name.includes(q) || ip.includes(q) || type.includes(q) || n.id.toLowerCase().includes(q);
    });
  }, [nodes, query]);

  const zoomToNode = useCallback(
    (id: string) => {
      const n = nodes.find((x) => x.id === id);
      if (!n) return;
      setSelectedNodeId(id);
      setSelectedEdgeId(null);
      rf.fitView({ nodes: [n], padding: 0.65, duration: 500 });
    },
    [nodes, rf]
  );

  // auto layout + salvar posições
  const autoLayoutAndSave = useCallback(async () => {
    try {
      const laidOut = layoutWithDagre(nodes, edges, "TB");
      setNodes(laidOut);

      await Promise.all(
        laidOut.map((n) => patchDevicePosition(n.id, n.position.x, n.position.y))
      );

      showToast("Layout aplicado e salvo ✅");
      requestAnimationFrame(() => rf.fitView({ padding: 0.4, duration: 400 }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "unknown";
      showToast(`Erro no layout: ${msg}`);
    }
  }, [nodes, edges, rf, showToast]);

  // atalho Delete/Backspace + Ctrl+K
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNode || selectedEdge) setOpenConfirmDelete(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("topo-search") as HTMLInputElement | null;
        el?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNode, selectedEdge]);

  const nodeOptions = useMemo(
    () => nodes.map((n) => ({ id: n.id, label: `${n.data.name} (${n.data.type})` })),
    [nodes]
  );

  return (
    <div className="relative h-full w-full bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        panOnDrag
        zoomOnScroll
        selectionOnDrag
      >
        <Background gap={22} size={1} />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {/* Left actions + search */}
      <div className="absolute left-3 top-3 z-30 flex flex-col gap-2">
        <div className="w-[380px] rounded-2xl border border-slate-900/10 bg-white/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,.12)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <input
              id="topo-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, IP, tipo… (Ctrl+K)"
              className="h-10 flex-1 rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              onClick={() => setOpenAddDevice(true)}
              className="h-10 rounded-xl bg-slate-900 px-3 text-[12px] font-extrabold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              + Equip
            </button>
            <button
              onClick={() => setOpenAddLink(true)}
              className="h-10 rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-extrabold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              + Link
            </button>
          </div>

          {query.trim() && (
            <div className="mt-2 max-h-[180px] overflow-auto rounded-xl border border-slate-900/10 bg-white dark:border-slate-700 dark:bg-slate-900">
              {filteredNodes.length === 0 ? (
                <div className="p-3 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Nada encontrado.</div>
              ) : (
                filteredNodes.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => zoomToNode(n.id)}
                    className="flex w-full items-center justify-between gap-2 border-b border-slate-900/5 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-extrabold text-slate-900 dark:text-slate-100">{n.data.name}</div>
                      <div className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {n.data.type.toUpperCase()}
                        {n.data.ip ? ` • ${n.data.ip}` : ""}
                      </div>
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500">Zoom</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => load()}
            className="rounded-2xl border border-slate-900/10 bg-white/90 px-3 py-2 text-[12px] font-extrabold text-slate-900 shadow-sm backdrop-blur hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Recarregar
          </button>

          <button
            onClick={autoLayoutAndSave}
            className="rounded-2xl bg-slate-900 px-3 py-2 text-[12px] font-extrabold text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Auto layout + salvar
          </button>

          <button
            onClick={() => setOpenConfirmDelete(true)}
            disabled={!selectedNode && !selectedEdge}
            className="rounded-2xl border border-rose-500/25 bg-white/90 px-3 py-2 text-[12px] font-extrabold text-rose-600 shadow-sm backdrop-blur hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-500/40 dark:bg-slate-900/90 dark:text-rose-300 dark:hover:bg-rose-950/40"
            title="Delete / Backspace"
          >
            Deletar
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="absolute right-3 top-3 z-30 w-[360px] rounded-2xl border border-slate-900/10 bg-white/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,.12)] backdrop-blur dark:border-slate-700/60 dark:bg-slate-900/90">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
            {loading ? "Carregando..." : "Painel"}
          </h2>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Selecione um item</span>
        </div>

        <div className="mb-3 rounded-xl border border-slate-900/10 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Selecionado</div>
          <div className="mt-1 text-[12px] font-extrabold text-slate-900 dark:text-slate-100">
            {selectedNode
              ? `Equipamento: ${selectedNode.data.name}`
              : selectedEdge
              ? `Link: ${selectedEdge.source} → ${selectedEdge.target}`
              : "Nada selecionado"}
          </div>
        </div>

        {selectedNode && (
          <div className="mb-3 rounded-xl border border-slate-900/10 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Status do equipamento</div>

            <div className="mt-2 flex items-center gap-2">
              <StatusPill status={selectedNode.data.status} />
              <select
                className="h-10 flex-1 rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                value={selectedNode.data.status}
                onChange={(e) => changeNodeStatus(e.target.value as DeviceStatus)}
              >
                <option value="up">up</option>
                <option value="warn">warn</option>
                <option value="down">down</option>
              </select>
            </div>

            <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Arraste e solte para salvar posição.
            </div>
          </div>
        )}

        {selectedEdge && (
          <div className="rounded-xl border border-slate-900/10 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Status do link</div>
            <select
              className="mt-2 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-bold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={selectedEdge.data?.status ?? "up"}
              onChange={(e) => changeEdgeStatus(e.target.value as LinkStatus)}
            >
              <option value="up">up</option>
              <option value="warn">warn</option>
              <option value="down">down</option>
            </select>

            <div className="mt-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Delete/Backspace para remover.
            </div>
          </div>
        )}

        <div className="mt-3 text-[11px] font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
          • Ctrl+K abre busca. <br />
          • Auto layout organiza e salva tudo no banco.
        </div>
      </div>

      {/* Modais */}
      <Modal open={openAddDevice} title="Adicionar equipamento" onClose={() => setOpenAddDevice(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Nome</label>
            <input
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Ex: SW-CORE-01"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Tipo</label>
              <select
                value={devType}
                onChange={(e) => setDevType(e.target.value as DeviceType)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="hub">hub</option>
                <option value="switch">switch</option>
                <option value="router">router</option>
                <option value="ap">ap</option>
                <option value="server">server</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">IP (opcional)</label>
              <input
                value={devIp}
                onChange={(e) => setDevIp(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                placeholder="10.0.1.2"
              />
            </div>
          </div>

          <button
            onClick={submitCreateDevice}
            className="h-10 w-full rounded-xl bg-slate-900 text-[12px] font-extrabold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Criar equipamento
          </button>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Ele será criado perto do centro da tela.
          </div>
        </div>
      </Modal>

      <Modal open={openAddLink} title="Conectar equipamentos (criar link)" onClose={() => setOpenAddLink(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Origem</label>
            <select
              value={linkFrom}
              onChange={(e) => setLinkFrom(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {nodeOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Destino</label>
            <select
              value={linkTo}
              onChange={(e) => setLinkTo(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {nodeOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Label (opcional)</label>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-slate-900/10 bg-white px-3 text-[12px] font-semibold text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Ex: UPLINK"
            />
          </div>

          <button
            onClick={submitCreateLink}
            className="h-10 w-full rounded-xl bg-slate-900 text-[12px] font-extrabold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Criar link
          </button>

          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Dica: depois use “Auto layout + salvar”.
          </div>
        </div>
      </Modal>

      <Modal open={openConfirmDelete} title="Confirmar deleção" onClose={() => setOpenConfirmDelete(false)}>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-900/10 bg-slate-50 p-3 text-[12px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {selectedNode
              ? `Você vai deletar o equipamento "${selectedNode.data.name}". Os links ligados a ele serão removidos.`
              : selectedEdge
              ? `Você vai deletar o link "${selectedEdge.source} → ${selectedEdge.target}".`
              : "Nada selecionado."}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setOpenConfirmDelete(false)}
              className="h-10 flex-1 rounded-xl border border-slate-900/10 bg-white text-[12px] font-extrabold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              disabled={!selectedNode && !selectedEdge}
              className="h-10 flex-1 rounded-xl bg-rose-600 text-[12px] font-extrabold text-white hover:bg-rose-500 disabled:opacity-50 dark:bg-rose-500 dark:hover:bg-rose-400"
            >
              Deletar
            </button>
          </div>
        </div>
      </Modal>

      {toast && <Toast text={toast} />}
    </div>
  );
}
