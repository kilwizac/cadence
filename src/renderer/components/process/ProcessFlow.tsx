import { useMemo, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Group, NativeSelect, Paper, Stack, Text, Textarea, Tooltip, useComputedColorScheme } from "@mantine/core";
import { IconArrowsMaximize, IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import { Graph, layout } from "@dagrejs/dagre";
import { Background, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Process, Step } from "../../../shared/types";
import { newStep } from "../../model";
import { EmptyState } from "../ui";
import { StepConnections } from "./StepConnections";
import { STEP_TYPES, StepFields } from "./StepFields";
import { removeProcessStep, workflowEdges } from "./workflow";
import "./ProcessFlow.css";

type StepNode = Node<{ step: Step; number: number }, "step">;

const nodeWidth = 224;
const nodeHeight = 102;
const edgeColor = "var(--mantine-color-dimmed)";
const fitOptions = { padding: 0.18, maxZoom: 1 };

function FlowStepNode({ data: { step, number }, selected }: NodeProps<StepNode>) {
  const { label, tone } = STEP_TYPES[step.type ?? "action"];
  return (
    <Paper
      withBorder
      w="100%"
      h="100%"
      p="sm"
      className={selected ? "process-flow-node process-flow-node-selected" : "process-flow-node"}
      style={{ borderTopColor: `var(--mantine-color-${tone}-filled)` }}
    >
      <Handle type="target" position={Position.Top} />
      <Stack gap={5}>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" fw={600}>{number}</Text>
          <Badge size="xs" color={tone}>{label}</Badge>
          {(step.durationMinutes ?? 0) > 0 && <Text size="xs" c="dimmed" ml="auto">{step.durationMinutes} min</Text>}
        </Group>
        <Text size="sm" fw={600} lineClamp={2} style={{ overflowWrap: "anywhere" }}>{step.text || "Untitled step"}</Text>
        {step.role && <Badge size="xs" color="gray" maw="100%" style={{ alignSelf: "flex-start" }}>{step.role}</Badge>}
      </Stack>
      <Handle type="source" position={Position.Bottom} />
    </Paper>
  );
}

const nodeTypes = { step: FlowStepNode };

export default function ProcessFlow({ process, edit }: { process: Process; edit: (recipe: (draft: Process) => void) => void }) {
  const [selectedId, setSelectedId] = useState(process.steps[0]?.id);
  const [deletingId, setDeletingId] = useState<string>();
  const [canvas, setCanvas] = useState<ReactFlowInstance<StepNode, Edge>>();
  const addButton = useRef<HTMLButtonElement>(null);
  const stepPicker = useRef<HTMLSelectElement>(null);
  const stepText = useRef<HTMLTextAreaElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const colorMode = useComputedColorScheme("light");
  const selected = process.steps.find((step) => step.id === selectedId) ?? process.steps[0];

  const { nodes, edges } = useMemo(() => {
    const graph = new Graph()
      .setGraph({ rankdir: "TB", ranksep: 70, nodesep: 44 })
      .setDefaultEdgeLabel(() => ({}));
    for (const step of process.steps) graph.setNode(step.id, { width: nodeWidth, height: nodeHeight });
    const connections = workflowEdges(process.steps);
    for (const { source, target } of connections) graph.setEdge(source, target);
    layout(graph);

    const nodes: StepNode[] = process.steps.map((step, index) => {
      const { x, y } = graph.node(step.id);
      return {
        id: step.id,
        type: "step",
        position: { x: x - nodeWidth / 2, y: y - nodeHeight / 2 },
        data: { step, number: index + 1 },
        width: nodeWidth,
        height: nodeHeight,
        selected: step.id === selected?.id,
        ariaLabel: `Step ${index + 1}: ${step.text || "Untitled step"}. ${STEP_TYPES[step.type ?? "action"].label}${step.role ? `, ${step.role}` : ""}`,
      };
    });
    const edges: Edge[] = connections.map((connection) => ({
      ...connection,
      id: JSON.stringify([connection.source, connection.target]),
      type: "smoothstep",
      selectable: false,
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      style: { stroke: edgeColor, strokeWidth: 1.5 },
      labelStyle: { fill: "var(--mantine-color-text)", fontWeight: 600 },
      labelBgStyle: { fill: "var(--mantine-color-body)" },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 4,
    }));
    return { nodes, edges };
  }, [process.steps, selected?.id]);

  const editStep = (id: string, recipe: (draft: Step) => void) =>
    edit((draft) => {
      const step = draft.steps.find((candidate) => candidate.id === id);
      if (step) recipe(step);
    });

  const selectStep = (id: string) => {
    setSelectedId(id);
    setDeletingId(undefined);
  };

  const connect = (source: string, target: string) => {
    if (source === target || !process.steps.some((step) => step.id === target)) return;
    const id = crypto.randomUUID();
    editStep(source, (step) => {
      if (step.type === "decision") {
        const branches = (step.branches ??= []);
        const label = ["Yes", "No"][branches.length];
        const used = new Set(branches.map((branch) => branch.label.trim().toLowerCase()));
        let number = branches.length + 1;
        while (used.has(`branch ${number}`)) number++;
        branches.push({ id, label: label && !used.has(label.toLowerCase()) ? label : `Branch ${number}`, targetStepId: target });
      } else {
        step.sequence = { targetStepId: target };
      }
    });
    selectStep(source);
  };

  const addStep = () => {
    const step = newStep("");
    edit((draft) => void draft.steps.push(step));
    selectStep(step.id);
    void canvas?.fitView(fitOptions);
    requestAnimationFrame(() => stepText.current?.focus());
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" gap="xs">
        <Text size="sm" c="dimmed">Drag from a lower handle to connect steps, or use the step editor.</Text>
        <Button ref={addButton} leftSection={<IconPlus size={16} />} onClick={addStep}>Add step</Button>
      </Group>
      <div className="process-flow-layout">
        <Paper withBorder className="process-flow-canvas">
          {nodes.length ? (
            <>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                forceColorMode={colorMode}
                fitView
                fitViewOptions={fitOptions}
                minZoom={0.15}
                maxZoom={2}
                nodesDraggable={false}
                edgesFocusable={false}
                deleteKeyCode={null}
                multiSelectionKeyCode={null}
                isValidConnection={({ source, target }) => source !== target}
                onConnect={({ source, target }) => connect(source, target)}
                onNodesChange={(changes) => {
                  const next = changes.getByType("select").find((change) => change.selected);
                  if (next) selectStep(next.id);
                }}
                onInit={setCanvas}
                ariaLabelConfig={{ "node.a11yDescription.default": "Press Enter or Space to edit this step." }}
              >
                <Background gap={20} />
              </ReactFlow>
              <Group gap={4} className="process-flow-zoom" aria-label="Flow zoom">
                <Tooltip label="Zoom in"><ActionIcon variant="default" aria-label="Zoom in" onClick={() => void canvas?.zoomIn()}><IconPlus size={16} /></ActionIcon></Tooltip>
                <Tooltip label="Zoom out"><ActionIcon variant="default" aria-label="Zoom out" onClick={() => void canvas?.zoomOut()}><IconMinus size={16} /></ActionIcon></Tooltip>
                <Tooltip label="Fit flow"><ActionIcon variant="default" aria-label="Fit flow" onClick={() => void canvas?.fitView(fitOptions)}><IconArrowsMaximize size={16} /></ActionIcon></Tooltip>
              </Group>
            </>
          ) : (
            <EmptyState title="No steps yet" body="Add the first step to start mapping this process." />
          )}
        </Paper>
        {selected && (
          <Paper component="aside" aria-label="Step editor" withBorder p="sm" className="process-flow-sidebar">
            <Stack gap="sm">
              <NativeSelect
                ref={stepPicker}
                label="Edit step"
                size="xs"
                data={process.steps.map((step, index) => ({ value: step.id, label: `${index + 1}. ${step.text.trim() || "Untitled step"}` }))}
                value={selected.id}
                onChange={(event) => selectStep(event.currentTarget.value)}
              />
              <Textarea
                ref={stepText}
                label="Step text"
                size="xs"
                value={selected.text}
                placeholder="What happens in this step?"
                autosize
                minRows={2}
                maxRows={6}
                onChange={(event) => {
                  const text = event.currentTarget.value;
                  editStep(selected.id, (draft) => void (draft.text = text));
                }}
              />
              <StepFields step={selected} onChange={(changes) => editStep(selected.id, (draft) => void Object.assign(draft, changes))} />
              <StepConnections step={selected} steps={process.steps} edit={(recipe) => editStep(selected.id, recipe)} onConnect={(id) => connect(selected.id, id)} />
              {deletingId === selected.id ? (
                <Paper withBorder p="xs">
                  <Text size="xs">Delete this step and its connections?</Text>
                  <Group gap={6} mt={6}>
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => {
                        setDeletingId(undefined);
                        requestAnimationFrame(() => deleteButton.current?.focus());
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      onClick={() => {
                        edit((draft) => removeProcessStep(draft, selected.id));
                        setDeletingId(undefined);
                        requestAnimationFrame(() => (stepPicker.current ?? addButton.current)?.focus());
                      }}
                    >
                      Delete step
                    </Button>
                  </Group>
                </Paper>
              ) : (
                <Button ref={deleteButton} size="xs" variant="subtle" color="red" style={{ alignSelf: "flex-start" }} leftSection={<IconTrash size={15} />} onClick={() => setDeletingId(selected.id)}>
                  Delete step
                </Button>
              )}
            </Stack>
          </Paper>
        )}
      </div>
    </Stack>
  );
}
