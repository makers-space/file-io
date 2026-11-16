/**
 * Flow - Interactive flow diagram component with React Flow
 * 
 * Properly leverages @xyflow/react features:
 * ✓ useNodesState/useEdgesState - Hook-based state management (passed directly to ReactFlow)
 * ✓ useReactFlow - Access flow instance in custom nodes
 * ✓ Handle component - Bidirectional handles (both source & target) on all four sides
 * ✓ Position enum - Proper handle positioning (Top, Left, Right, Bottom)
 * ✓ Custom node types - EditableNode for inline editing with typography controls
 * ✓ Built-in group nodes - Subflow support with parent-child relationships using type: 'group'
 * ✓ Uncontrolled component - Internal state is source of truth
 * ✓ Parent notifications - onChange fires on every state change (notification only, not bidirectional)
 * ✓ addEdge utility - Properly handles new connections
 * ✓ useMemo - Performance optimization for computed values (one-time sanitization)
 * ✓ Panel component available (imported but can be used by consumers)
 * 
 * Features:
 * - Right-click context menu (Genie) for node editing: label, color, shape, type, typography (size/weight/align)
 * - Right-click context menu (Genie) for edge editing: type, color, width, animation, arrows, labels
 * - Ctrl/Cmd+click or Alt+click node creation with editable type
 * - Double-click inline editing on editable nodes
 * - Full bidirectional connectivity (any handle can connect to any other handle)
 * - Subflow support: nodes with type 'group' can contain child nodes using parentId, extent, and expandParent
 * - Theme integration
 * - All React Flow props passthrough
 * 
 * Subflow Usage:
 * - Set node type to 'group' to create a container node (uses React Flow's built-in group styling)
 * - Add parentId to child nodes to nest them inside a group
 * - Use extent: 'parent' to constrain child movement within parent bounds
 * - Set expandParent: true to auto-expand parent when child is dragged to edge
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  NodeResizer,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from '../contexts/ThemeContext';
import Genie from './Genie';
import { Input } from './Input';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Container } from './Container';
import { Typography } from './Typography';
import { Select } from './Select';
import { Icon } from './Icon';
import { Card } from './Card';

const DEFAULT_NODE_SHAPE = 'rectangle';
const DEFAULT_NODE_COLOR_TOKEN = 'primary';
const DEFAULT_EDGE_COLOR_TOKEN = 'primary';

const NODE_SHAPE_OPTIONS = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'cylinder', label: 'Cylinder' }
];

const COLOR_VARIANTS = [
  'primary',
  'secondary',
  'tertiary',
  'success',
  'warning',
  'error',
  'neutral',
  'surface',
  'background'
];

const COLOR_OPTIONS = COLOR_VARIANTS.map((variant) => ({
  value: variant,
  label: variant.charAt(0).toUpperCase() + variant.slice(1)
}));

const COLOR_TOKEN_TO_VAR = {
  primary: 'var(--primary-color)',
  secondary: 'var(--secondary-color)',
  tertiary: 'var(--tertiary-color)',
  success: 'var(--success-color)',
  warning: 'var(--warning-color)',
  error: 'var(--error-color)',
  neutral: 'var(--neutral-color, var(--text-muted, #64748b))',
  surface: 'var(--surface-color)',
  background: 'var(--background-color)'
};

const resolveColorToken = (value, fallback = DEFAULT_NODE_COLOR_TOKEN) => {
  if (!value) return fallback;
  const lowered = String(value).trim().toLowerCase();
  return COLOR_VARIANTS.includes(lowered) ? lowered : fallback;
};

const getColorVariable = (token, fallbackToken = DEFAULT_NODE_COLOR_TOKEN) => {
  const target = token && COLOR_TOKEN_TO_VAR[token] ? token : fallbackToken;
  return COLOR_TOKEN_TO_VAR[target] || COLOR_TOKEN_TO_VAR[fallbackToken];
};

const getNodeColorClass = (token) => `flow-node-color-${token}`;
const getEdgeColorClass = (token) => `flow-edge-color-${token}`;

const stripNodeColorStyle = (style = {}) => {
  if (!style) return undefined;
  const cleaned = { ...style };
  delete cleaned.background;
  delete cleaned.color;
  delete cleaned.border;
  delete cleaned['--flow-node-fill'];
  delete cleaned['--flow-node-border'];
  delete cleaned['--flow-node-text'];
  return Object.keys(cleaned).length ? cleaned : undefined;
};

const inferNodeColorToken = (nodeLike) => {
  if (!nodeLike) return DEFAULT_NODE_COLOR_TOKEN;
  return resolveColorToken(nodeLike.data?.color, DEFAULT_NODE_COLOR_TOKEN);
};

const inferEdgeColorToken = (edgeLike) => {
  if (!edgeLike) return DEFAULT_EDGE_COLOR_TOKEN;
  return resolveColorToken(edgeLike.data?.color, DEFAULT_EDGE_COLOR_TOKEN);
};

const withEdgeColorClass = (className, token) => {
  const classes = new Set((className || '').split(' ').filter(Boolean));
  COLOR_VARIANTS.forEach((variant) => classes.delete(getEdgeColorClass(variant)));
  classes.add('flow-edge');
  classes.add(getEdgeColorClass(token));
  return Array.from(classes).join(' ');
};

const buildEdgeStyle = (style = {}, colorToken = DEFAULT_EDGE_COLOR_TOKEN, strokeWidth = style?.strokeWidth ?? 2) => ({
  ...style,
  stroke: getColorVariable(colorToken, DEFAULT_EDGE_COLOR_TOKEN),
  strokeWidth
});

const buildMarkerEnd = (markerEnd, colorToken) => {
  if (!markerEnd) return undefined;
  const base = typeof markerEnd === 'string' ? { type: markerEnd } : { ...markerEnd };
  if (!base.type) return undefined;
  return {
    ...base,
    color: getColorVariable(colorToken, DEFAULT_EDGE_COLOR_TOKEN)
  };
};

const sanitizeNode = (node) => {
  if (!node) return node;
  const colorToken = inferNodeColorToken(node);
  const shape = node.data?.shape || DEFAULT_NODE_SHAPE;
  const cleanedStyle = stripNodeColorStyle(node.style);
  const { style: _prevStyle, ...rest } = node;
  
  // Add class for group nodes to handle coloring
  const isGroup = node.type === 'group';
  const colorClass = isGroup ? getNodeColorClass(colorToken) : '';
  const existingClasses = (node.className || '').split(' ').filter(c => !c.startsWith('flow-node-color-'));
  const className = isGroup ? [...existingClasses, colorClass].join(' ') : node.className;

  return {
    ...rest,
    className,
    data: { ...node.data, color: colorToken, shape },
    ...(cleanedStyle ? { style: cleanedStyle } : {}),
    // Preserve subflow properties
    ...(node.parentId ? { parentId: node.parentId } : {}),
    ...(node.extent ? { extent: node.extent } : {}),
    ...(node.expandParent !== undefined ? { expandParent: node.expandParent } : {})
  };
};

const sanitizeEdge = (edge) => {
  if (!edge) return edge;
  const colorToken = inferEdgeColorToken(edge);
  const strokeWidth = edge.style?.strokeWidth ?? 2;
  return {
    ...edge,
    data: { ...edge.data, color: colorToken },
    className: withEdgeColorClass(edge.className, colorToken),
    style: buildEdgeStyle(edge.style, colorToken, strokeWidth),
    markerEnd: buildMarkerEnd(edge.markerEnd, colorToken)
  };
};

// ===== Flow text =====
// A flow is kept as plain text: <Flow> holding <Group />, <Node /> and <Edge /> lines.
// parseFlow turns that text into nodes and edges; writeFlow turns nodes and edges back into the same text.
export const FLOW_LIMITS = { nodes: 500, edges: 1000, text: 4000 };

const FLOW_TAG = /<\s*(Node|Group|Edge)\b((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/\s*>|>([^<]*)<\/\s*\1\s*>|>)/gi;
const FLOW_ATTRIBUTE = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'>/]+))/g;
const FLOW_NODE_KEYS = ['id', 'label', 'color', 'shape', 'x', 'y', 'width', 'height', 'group', 'size', 'weight', 'align'];
const FLOW_SHAPES = NODE_SHAPE_OPTIONS.map((option) => option.value);
const FLOW_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const FLOW_WEIGHTS = ['light', 'normal', 'medium', 'semibold', 'bold', 'extrabold'];
const FLOW_ALIGNS = ['left', 'center', 'right'];
const FLOW_EDGE_TYPES = ['smoothstep', 'straight', 'default', 'step', 'simplebezier'];
const FLOW_SIDES = ['top', 'right', 'bottom', 'left'];
const FLOW_DETAIL_KEY = /^[a-z_][\w-]*$/;
const FLOW_DROPPED_KEY = /^(style|class|classname|on(click|dblclick|load|error|focus|blur|change|submit|input|mouse\w+|key\w+|pointer\w+|touch\w+))$/;

const unescapeFlow = (value) => String(value)
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, '\n').replace(/&amp;/g, '&');
const escapeFlow = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n/g, '&#10;');
const flowNumber = (value) => (value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Math.round(Number(value)) : null);
const oneOf = (value, list) => (list.includes(String(value ?? '').toLowerCase()) ? String(value).toLowerCase() : null);
const sideOf = (handle) => oneOf(String(handle ?? '').split('-')[0], FLOW_SIDES);

// How far along the connectors each box sits: a box is one step further than the furthest box leading into it.
const flowLevels = (ids, wires) => {
  const level = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const { source, target } of wires) {
      if (level.get(target) <= level.get(source) && level.get(source) < ids.length) {
        level.set(target, level.get(source) + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return level;
};

export const parseFlow = (text) => {
  const empty = { nodes: [], edges: [], error: null };
  const source = String(text ?? '');
  if (!source.trim()) return empty;
  if (!/<\s*Flow[\s>/]/i.test(source)) return { ...empty, error: 'This file does not hold a flow.' };

  const boxes = [];
  const links = [];
  for (const match of source.matchAll(FLOW_TAG)) {
    const props = {};
    for (const attribute of match[2].matchAll(FLOW_ATTRIBUTE)) {
      props[attribute[1].toLowerCase()] = unescapeFlow(attribute[2] ?? attribute[3] ?? attribute[4] ?? attribute[5] ?? '').slice(0, FLOW_LIMITS.text);
    }
    if (props.label === undefined && match[4]?.trim()) props.label = unescapeFlow(match[4].trim()).slice(0, FLOW_LIMITS.text);
    const kind = match[1].toLowerCase();
    (kind === 'edge' ? links : boxes).push({ kind, props });
  }
  if (boxes.length > FLOW_LIMITS.nodes) return { ...empty, error: `This flow has more than ${FLOW_LIMITS.nodes} boxes, which is too many to open.` };
  if (links.length > FLOW_LIMITS.edges) return { ...empty, error: `This flow has more than ${FLOW_LIMITS.edges} connectors, which is too many to open.` };

  const seen = new Set();
  const named = boxes.filter(({ props }) => {
    if (!props.id || seen.has(props.id)) return false;
    seen.add(props.id);
    return true;
  });
  const groupIds = new Set(named.filter((box) => box.kind === 'group').map((box) => box.props.id));

  const groups = named.filter((box) => box.kind === 'group').map(({ props }, index) => ({
    id: props.id,
    type: 'group',
    position: { x: flowNumber(props.x) ?? index * 340, y: flowNumber(props.y) ?? 0 },
    data: { label: props.label ?? '', color: resolveColorToken(props.color, 'neutral') },
    style: { width: flowNumber(props.width) ?? 300, height: flowNumber(props.height) ?? 200 }
  }));

  const steps = named.filter((box) => box.kind === 'node');
  const stepIds = new Set(steps.map((box) => box.props.id));
  const wires = links.filter(({ props }) => stepIds.has(props.source) && stepIds.has(props.target));

  // Boxes with no position are laid out left to right, following the connectors.
  const level = flowLevels(steps.map((box) => box.props.id), wires.map(({ props }) => props));
  const rows = new Map();
  const inGroup = new Map();

  const nodes = steps.map(({ props }) => {
    const parent = groupIds.has(props.group) ? props.group : null;
    let position = flowNumber(props.x) !== null && flowNumber(props.y) !== null ? { x: flowNumber(props.x), y: flowNumber(props.y) } : null;
    if (!position && parent) {
      const place = inGroup.get(parent) || 0;
      inGroup.set(parent, place + 1);
      position = { x: 24, y: 40 + place * 70 };
    }
    if (!position) {
      const column = level.get(props.id);
      const row = rows.get(column) || 0;
      rows.set(column, row + 1);
      position = { x: column * 240, y: row * 110 };
    }
    const details = {};
    for (const [key, value] of Object.entries(props)) {
      if (!FLOW_NODE_KEYS.includes(key) && FLOW_DETAIL_KEY.test(key) && !FLOW_DROPPED_KEY.test(key)) details[key] = value;
    }
    const data = { label: props.label ?? props.id, color: resolveColorToken(props.color), shape: oneOf(props.shape, FLOW_SHAPES) || DEFAULT_NODE_SHAPE };
    if (oneOf(props.size, FLOW_SIZES)) data.fontSize = oneOf(props.size, FLOW_SIZES);
    if (oneOf(props.weight, FLOW_WEIGHTS)) data.fontWeight = oneOf(props.weight, FLOW_WEIGHTS);
    if (oneOf(props.align, FLOW_ALIGNS)) data.textAlign = oneOf(props.align, FLOW_ALIGNS);
    if (Object.keys(details).length > 0) data.details = details;
    return {
      id: props.id,
      type: 'editable',
      position,
      data,
      ...(parent ? { parentId: parent } : {})
    };
  });

  const edges = wires.map(({ props }, index) => {
    const arrow = String(props.arrow ?? '').toLowerCase();
    return {
      id: `edge-${index}`,
      source: props.source,
      target: props.target,
      sourceHandle: `${oneOf(props.from, FLOW_SIDES) || 'right'}-source`,
      targetHandle: `${oneOf(props.to, FLOW_SIDES) || 'left'}-target`,
      ...(props.label ? { label: props.label } : {}),
      type: oneOf(props.type, FLOW_EDGE_TYPES) || 'smoothstep',
      animated: props.animated === 'true',
      data: { color: resolveColorToken(props.color, DEFAULT_EDGE_COLOR_TOKEN) },
      style: { strokeWidth: Math.min(Math.max(flowNumber(props.width) ?? 2, 1), 10) },
      ...(arrow === 'none' ? {} : { markerEnd: { type: arrow === 'open' ? 'arrow' : 'arrowclosed' } })
    };
  });

  return { nodes: [...groups, ...nodes], edges, error: null };
};

export const writeFlow = (nodes = [], edges = [], { positions = true } = {}) => {
  const line = (tag, pairs) => `  <${tag} ${pairs.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([key, value]) => `${key}="${escapeFlow(value)}"`).join(' ')} />`;
  const groupIds = new Set(nodes.filter((node) => node.type === 'group').map((node) => node.id));
  const stepIds = new Set(nodes.filter((node) => node.type !== 'group').map((node) => node.id));
  const lines = [];

  for (const node of nodes) {
    if (node.type !== 'group') continue;
    const color = resolveColorToken(node.data?.color, 'neutral');
    lines.push(line('Group', [
      ['id', node.id], ['label', node.data?.label],
      ['color', color === 'neutral' ? null : color],
      ['x', Math.round(node.position?.x ?? 0)], ['y', Math.round(node.position?.y ?? 0)],
      ['width', flowNumber(node.width ?? node.style?.width) ?? 300], ['height', flowNumber(node.height ?? node.style?.height) ?? 200]
    ]));
  }
  for (const node of nodes) {
    if (node.type === 'group') continue;
    const data = node.data || {};
    const color = resolveColorToken(data.color);
    const details = Object.entries(data.details || {}).filter(([key]) => !FLOW_NODE_KEYS.includes(key) && FLOW_DETAIL_KEY.test(key));
    lines.push(line('Node', [
      ['id', node.id], ['label', data.label],
      ['color', color === DEFAULT_NODE_COLOR_TOKEN ? null : color],
      ['shape', data.shape && data.shape !== DEFAULT_NODE_SHAPE ? data.shape : null],
      ['x', positions ? Math.round(node.position?.x ?? 0) : null], ['y', positions ? Math.round(node.position?.y ?? 0) : null],
      ['group', groupIds.has(node.parentId) ? node.parentId : null],
      ['size', data.fontSize && data.fontSize !== 'md' ? data.fontSize : null],
      ['weight', data.fontWeight && data.fontWeight !== 'semibold' ? data.fontWeight : null],
      ['align', data.textAlign && data.textAlign !== 'center' ? data.textAlign : null],
      ...details
    ]));
  }
  for (const edge of edges) {
    if (!stepIds.has(edge.source) || !stepIds.has(edge.target)) continue;
    const color = resolveColorToken(edge.data?.color, DEFAULT_EDGE_COLOR_TOKEN);
    const from = sideOf(edge.sourceHandle);
    const to = sideOf(edge.targetHandle);
    const marker = typeof edge.markerEnd === 'string' ? edge.markerEnd : edge.markerEnd?.type;
    const width = flowNumber(edge.style?.strokeWidth) ?? 2;
    lines.push(line('Edge', [
      ['source', edge.source], ['target', edge.target],
      ['label', typeof edge.label === 'string' ? edge.label : null],
      ['color', color === DEFAULT_EDGE_COLOR_TOKEN ? null : color],
      ['type', edge.type && edge.type !== 'smoothstep' ? edge.type : null],
      ['animated', edge.animated ? 'true' : null],
      ['arrow', !marker ? 'none' : marker === 'arrow' ? 'open' : null],
      ['width', width !== 2 ? width : null],
      ['from', from && from !== 'right' ? from : null],
      ['to', to && to !== 'left' ? to : null]
    ]));
  }
  return `<Flow>\n${lines.join('\n')}${lines.length ? '\n' : ''}</Flow>\n`;
};

const FlowLock = createContext(false);

// The toolbar's actions, in order. "edit" actions change the flow and are left out when it is read-only.
const FLOW_ACTIONS = [
  { id: 'step', kind: 'edit', icon: 'FiPlusSquare', label: 'Add a step', keys: 'N' },
  { id: 'group', kind: 'edit', icon: 'FiGrid', label: 'Add a group', keys: 'G' },
  { id: 'edit', kind: 'edit', icon: 'FiEdit2', label: 'Edit what is selected', keys: 'E', needs: 'one' },
  { id: 'duplicate', kind: 'edit', icon: 'FiCopy', label: 'Duplicate', keys: 'Ctrl+D', needs: 'steps' },
  { id: 'delete', kind: 'edit', icon: 'FiTrash2', label: 'Delete', keys: 'Delete', needs: 'any' },
  { id: 'selectAll', kind: 'edit', icon: 'FiCheckSquare', label: 'Select everything', keys: 'Ctrl+A' },
  { id: 'undo', kind: 'edit', icon: 'FiCornerUpLeft', label: 'Undo', keys: 'Ctrl+Z', needs: 'undo' },
  { id: 'redo', kind: 'edit', icon: 'FiCornerUpRight', label: 'Redo', keys: 'Ctrl+Y', needs: 'redo' },
  { id: 'tidy', kind: 'edit', icon: 'FiLayout', label: 'Arrange', keys: 'L' },
  { id: 'zoomIn', kind: 'view', icon: 'FiZoomIn', label: 'Zoom in', keys: '+' },
  { id: 'zoomOut', kind: 'view', icon: 'FiZoomOut', label: 'Zoom out', keys: '-' },
  { id: 'fit', kind: 'view', icon: 'FiMaximize', label: 'Fit everything on screen', keys: 'F' },
  { id: 'snap', kind: 'edit', icon: 'FiCrosshair', label: 'Snap to the dots', keys: 'S' },
  { id: 'lock', kind: 'edit', icon: 'FiLock', label: 'Lock moving', keys: 'K' },
  { id: 'map', kind: 'view', icon: 'FiMap', label: 'Show or hide the map', keys: 'M' }
];
const FLOW_HISTORY = 100;
const FLOW_LAYOUTS = [
  { id: 'lr', icon: 'FiArrowRight', label: 'Arrange everything left to right (L)' },
  { id: 'tb', icon: 'FiArrowDown', label: 'Arrange everything top to bottom (Shift+L)' },
  { id: 'grid', icon: 'FiGrid', label: 'Arrange everything in a grid' },
  { id: 'circle', icon: 'FiCircle', label: 'Arrange everything in a circle' }
];
const FLOW_ALIGNMENTS = [
  { id: 'left', icon: 'MdAlignHorizontalLeft', label: 'Line up the left edges of what is selected', least: 2 },
  { id: 'top', icon: 'MdAlignVerticalTop', label: 'Line up the top edges of what is selected', least: 2 },
  { id: 'across', icon: 'MdHorizontalDistribute', label: 'Space what is selected evenly across', least: 3 },
  { id: 'down', icon: 'MdVerticalDistribute', label: 'Space what is selected evenly down', least: 3 }
];

// Custom Node for inline editing with bidirectional handles on all four sides
// Each position has BOTH source and target handles to allow any-to-any connections
const EditableNode = ({ data, id }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [label, setLabel] = useState(data.label);
  const reactFlow = useReactFlow();
  const locked = useContext(FlowLock);
  const nodeInstance = reactFlow.getNode ? reactFlow.getNode(id) : null;
  const colorToken = useMemo(() => inferNodeColorToken({ data, style: nodeInstance?.style }), [data, nodeInstance?.style]);
  const shape = data.shape || DEFAULT_NODE_SHAPE;
  
  // Typography props with defaults
  const fontSize = data.fontSize || 'md';
  const fontWeight = data.fontWeight || 'semibold';
  const textAlign = data.textAlign || 'center';

  useEffect(() => {
    setLabel(data.label);
  }, [data.label]);

  const handleDoubleClick = () => { if (!locked) setIsEditing(true); };

  const handleSave = () => {
    reactFlow.setNodes((nds) =>
      nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
    );
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setLabel(data.label);
      setIsEditing(false);
    }
  };

  return (
    <div className="flow-node" onDoubleClick={handleDoubleClick}>
      {/* Bidirectional connection handles on all four sides - each position has both source and target */}
      {/* Source handles can start connections, target handles can receive them */}
      <Handle type="source" position={Position.Top} id="top-source" isConnectableStart={true} isConnectableEnd={false} />
      <Handle type="target" position={Position.Top} id="top-target" isConnectableStart={false} isConnectableEnd={true} />

      <Handle type="source" position={Position.Right} id="right-source" isConnectableStart={true} isConnectableEnd={false} />
      <Handle type="target" position={Position.Right} id="right-target" isConnectableStart={false} isConnectableEnd={true} />

      <Handle type="source" position={Position.Bottom} id="bottom-source" isConnectableStart={true} isConnectableEnd={false} />
      <Handle type="target" position={Position.Bottom} id="bottom-target" isConnectableStart={false} isConnectableEnd={true} />

      <Handle type="source" position={Position.Left} id="left-source" isConnectableStart={true} isConnectableEnd={false} />
      <Handle type="target" position={Position.Left} id="left-target" isConnectableStart={false} isConnectableEnd={true} />

      <div 
        className={`flow-node-surface ${getNodeColorClass(colorToken)}`} 
        data-shape={shape} 
        data-color={colorToken}
        data-font-size={fontSize}
        data-font-weight={fontWeight}
        data-text-align={textAlign}
      >
        <div className="flow-node-geometry" aria-hidden="true" />
        {isEditing ? (
          <input
            className="flow-node-input"
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
          />
        ) : (
          <span className="flow-node-label">{data.label}</span>
        )}
      </div>
    </div>
  );
};

// Simple GroupNode to render label since native group doesn't render it by default
// A group shows its label, and resize handles while it is selected
const GroupNode = ({ data, selected }) => {
  const locked = useContext(FlowLock);
  return (
    <>
      {!locked && <NodeResizer isVisible={Boolean(selected)} minWidth={160} minHeight={100} />}
      {data.label}
    </>
  );
};

const nodeTypes = {
  editable: EditableNode,
  group: GroupNode
};

export const Flow = ({
  nodes: initialNodes = [],
  edges: initialEdges = [],
  fitView = true,
  fitViewOptions = { padding: 0.2 },
  theme = null,
  className = '',
  size = 'md',
  width = '100%',
  height = null,
  minHeight = '300px',
  style,
  draggable = true,
  connectable = true,
  selectable = true,
  deletable = true,
  zoomable = true,
  pannable = false,
  enableNodeCreation = false,
  nodeCreationKey = 'ctrl',
  defaultNodeData = { label: 'New Node', color: DEFAULT_NODE_COLOR_TOKEN, shape: DEFAULT_NODE_SHAPE },
  defaultNodeStyle = {},
  controls = true,
  minimap = false,
  background = true,
  backgroundVariant = 'dots',
  backgroundGap = 12,
  backgroundSize = 2,
  backgroundProps = {},
  controlsProps = {},
  minimapProps = {},
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onEdgeClick,
  onConnect: onConnectProp,
  onChange,
  onInit,
  onPaneClick,
  content,
  onContentChange,
  readOnly = false,
  toolbar = true,
  proOptions = { hideAttribution: true },
  connectEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    data: { color: DEFAULT_EDGE_COLOR_TOKEN },
    style: buildEdgeStyle(undefined, DEFAULT_EDGE_COLOR_TOKEN, 2),
    markerEnd: buildMarkerEnd('arrowclosed', DEFAULT_EDGE_COLOR_TOKEN)
  },
  ...reactFlowProps
}) => {
  const { currentTheme } = useTheme();
  const containerRef = useRef(null);
  const anchorRef = useRef(null);
  // Store ReactFlow instance for coordinate transformation in onPaneClick (before hook context available)
  const reactFlowInstanceRef = useRef(null);
  
  // Initialize with sanitized data once on mount. When flow text is given, the diagram is drawn from it.
  const fromText = content !== undefined && content !== null;
  const firstFlow = useMemo(() => (fromText ? parseFlow(content) : null), []);
  const sanitizedInitialNodes = useMemo(() => (firstFlow ? firstFlow.nodes : initialNodes).map(sanitizeNode), []);
  const sanitizedInitialEdges = useMemo(() => (firstFlow ? firstFlow.edges : initialEdges).map(sanitizeEdge), []);
  const shownTextRef = useRef(fromText ? content : null);
  const writtenTextRef = useRef(writeFlow(sanitizedInitialNodes, sanitizedInitialEdges));
  const historyRef = useRef({ past: [], future: [], jump: null });
  const [historySize, setHistorySize] = useState({ undo: 0, redo: 0 });
  const [locked, setLocked] = useState(false);
  const [snap, setSnap] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [mapShown, setMapShown] = useState(Boolean(minimap));
  const hoverRef = useRef(false);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(sanitizedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(sanitizedInitialEdges);
  const [nodeEditor, setNodeEditor] = useState(null);
  const [edgeEditor, setEdgeEditor] = useState(null);
  const edgeAnchorRef = useRef(null);

  const containerStyle = useMemo(() => {
    const sizeMap = { xs: '300px', sm: '400px', md: '500px', lg: '600px', xl: '800px' };
    return {
      width,
      height: height || sizeMap[size] || '500px',
      minHeight,
      ...style
    };
  }, [width, height, size, minHeight, style]);

  // Notify parent of changes
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.({ nodes, edges });
  }, [nodes, edges]);

  // A change made here is reported as flow text, once any drag has finished.
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useEffect(() => {
    if (nodes.some((node) => node.dragging)) return;
    const text = writeFlow(nodes, edges);
    if (text === writtenTextRef.current) return;
    const history = historyRef.current;
    if (history.jump === text) {
      history.jump = null;
    } else {
      history.past.push(writtenTextRef.current);
      if (history.past.length > FLOW_HISTORY) history.past.shift();
      history.future.length = 0;
    }
    setHistorySize({ undo: history.past.length, redo: history.future.length });
    writtenTextRef.current = text;
    if (!fromText || readOnly) return;
    shownTextRef.current = text;
    onContentChangeRef.current?.(text);
  }, [nodes, edges, fromText, readOnly]);

  // Flow text that changed somewhere else replaces what is drawn.
  useEffect(() => {
    if (!fromText || content === shownTextRef.current) return;
    shownTextRef.current = content;
    const next = parseFlow(content);
    if (next.error) return;
    const nextNodes = next.nodes.map(sanitizeNode);
    const nextEdges = next.edges.map(sanitizeEdge);
    writtenTextRef.current = writeFlow(nextNodes, nextEdges);
    historyRef.current = { past: [], future: [], jump: null };
    setHistorySize({ undo: 0, redo: 0 });
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [content, fromText, setNodes, setEdges]);

  const drawText = useCallback((text) => {
    const next = parseFlow(text);
    if (next.error) return;
    historyRef.current.jump = writeFlow(next.nodes.map(sanitizeNode), next.edges.map(sanitizeEdge));
    setNodes(next.nodes.map(sanitizeNode));
    setEdges(next.edges.map(sanitizeEdge));
  }, [setNodes, setEdges]);

  const stepBack = useCallback((from, to) => {
    const history = historyRef.current;
    if (history[from].length === 0) return;
    const text = history[from].pop();
    history[to].push(writtenTextRef.current);
    setHistorySize({ undo: history.past.length, redo: history.future.length });
    drawText(text);
  }, [drawText]);

  const addBox = useCallback((kind) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const instance = reactFlowInstanceRef.current;
    const centre = rect && instance?.screenToFlowPosition
      ? instance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 };
    setNodes((current) => {
      const prefix = kind === 'group' ? 'group' : 'step';
      let number = current.length + 1;
      while (current.some((node) => node.id === `${prefix}-${number}`)) number++;
      const nudge = (current.length % 6) * 24;
      // With one group selected, a new step is made inside it.
      const chosen = current.filter((node) => node.selected);
      const home = kind !== 'group' && chosen.length === 1 && chosen[0].type === 'group' ? chosen[0] : null;
      if (home) {
        const inside = current.filter((node) => node.parentId === home.id).length;
        return [...current, sanitizeNode({ id: `${prefix}-${number}`, type: 'editable', parentId: home.id, position: { x: 24 + (inside % 3) * 150, y: 44 + Math.floor(inside / 3) * 70 }, data: { label: 'New step' } })];
      }
      const box = kind === 'group'
        ? { id: `${prefix}-${number}`, type: 'group', position: { x: Math.round(centre.x - 150 + nudge), y: Math.round(centre.y - 100 + nudge) }, data: { label: 'Group', color: 'neutral' }, style: { width: 300, height: 200 } }
        : { id: `${prefix}-${number}`, type: 'editable', position: { x: Math.round(centre.x - 60 + nudge), y: Math.round(centre.y - 20 + nudge) }, data: { label: 'New step' } };
      return kind === 'group' ? [sanitizeNode(box), ...current] : [...current, sanitizeNode(box)];
    });
  }, [setNodes]);


  const onConnect = useCallback(
    (params) => {
      // Merge connectEdgeOptions with params, preferring params values
      const mergedEdge = {
        ...connectEdgeOptions,
        ...params,
        data: {
          ...connectEdgeOptions?.data,
          ...params?.data
        },
        style: {
          ...connectEdgeOptions?.style,
          ...params?.style
        },
        className: [connectEdgeOptions?.className, params?.className].filter(Boolean).join(' '),
        markerEnd: params?.markerEnd || connectEdgeOptions?.markerEnd
      };
      
      // Let sanitizeEdge handle all color resolution and theming
      const themedEdge = sanitizeEdge(mergedEdge);

      setEdges((eds) => addEdge(themedEdge, eds));
      onConnectProp?.(params);
    },
    [setEdges, connectEdgeOptions, onConnectProp]
  );

  const getNodeVisualState = useCallback((node) => ({
    color: inferNodeColorToken(node),
    shape: node.data?.shape || DEFAULT_NODE_SHAPE
  }), []);

  const onContextMenu = useCallback((e, node) => {
    e.preventDefault();
    if (readOnly) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const { color, shape } = getNodeVisualState(node);
    setNodeEditor({
      nodeId: node.id,
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
      label: String(node.data?.label ?? ''),
      color,
      shape,
      fontSize: node.data?.fontSize ?? 'md',
      fontWeight: node.data?.fontWeight ?? 'semibold',
      textAlign: node.data?.textAlign ?? 'center',
      nodeType: node.type ?? 'editable',
      parentId: node.parentId ?? '',
      extent: node.extent ?? ''
    });
    setEdgeEditor(null);
    onNodeContextMenu?.(e, node);
  }, [getNodeVisualState, onNodeContextMenu, readOnly]);
  
  const onEdgeContextMenuHandler = useCallback((e, edge) => {
    e.preventDefault();
    if (readOnly) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const color = inferEdgeColorToken(edge);
    setEdgeEditor({
      edgeId: edge.id,
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
      label: String(edge.label ?? ''),
      type: edge.type || 'smoothstep',
      animated: edge.animated ?? true,
      color,
      strokeWidth: edge.style?.strokeWidth || 2,
      markerEnd: edge.markerEnd?.type || 'arrowclosed'
    });
    setNodeEditor(null);
  }, [readOnly]);
  
  const saveNode = useCallback(() => {
    if (!nodeEditor) return;
    const colorToken = resolveColorToken(nodeEditor.color, DEFAULT_NODE_COLOR_TOKEN);
    const shape = nodeEditor.shape || DEFAULT_NODE_SHAPE;
    const fontSize = nodeEditor.fontSize || 'md';
    const fontWeight = nodeEditor.fontWeight || 'semibold';
    const textAlign = nodeEditor.textAlign || 'center';
    const nodeType = nodeEditor.nodeType || 'editable';
    const parentId = nodeEditor.parentId || undefined;
    const extent = nodeEditor.extent || undefined;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeEditor.nodeId) return n;
        const sanitizedStyle = stripNodeColorStyle(n.style);
        const { style: _omit, ...rest } = n;
        
        // Set default style for group nodes
        const groupStyle = nodeType === 'group' ? {
          ...sanitizedStyle,
          width: sanitizedStyle?.width || 300,
          height: sanitizedStyle?.height || 200
        } : sanitizedStyle;
        
        const isGroup = nodeType === 'group';
        const colorClass = isGroup ? getNodeColorClass(colorToken) : '';
        const existingClasses = (n.className || '').split(' ').filter(c => !c.startsWith('flow-node-color-'));
        const className = isGroup ? [...existingClasses, colorClass].join(' ') : n.className;

        return {
          ...rest,
          type: nodeType,
          className,
          data: { 
            ...n.data, 
            label: nodeEditor.label, 
            shape, 
            color: colorToken,
            fontSize,
            fontWeight,
            textAlign
          },
          ...(groupStyle ? { style: groupStyle } : {}),
          ...(parentId ? { parentId } : {}),
          ...(extent ? { extent } : {}),
          ...(parentId ? { expandParent: true } : {})
        };
      })
    );
    setNodeEditor(null);
  }, [nodeEditor, setNodes]);
  
  const saveEdge = useCallback(() => {
    if (!edgeEditor) return;
    const colorToken = resolveColorToken(edgeEditor.color, DEFAULT_EDGE_COLOR_TOKEN);
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeEditor.edgeId
          ? {
              ...e,
              label: edgeEditor.label || undefined,
              type: edgeEditor.type,
              animated: edgeEditor.animated,
              data: { ...e.data, color: colorToken },
              className: withEdgeColorClass(e.className, colorToken),
              style: buildEdgeStyle(e.style, colorToken, edgeEditor.strokeWidth ?? e.style?.strokeWidth ?? 2),
              markerEnd: buildMarkerEnd(edgeEditor.markerEnd, colorToken)
            }
          : e
      )
    );
    setEdgeEditor(null);
  }, [edgeEditor, setEdges]);
  
  const canEdit = !readOnly && toolbar !== 'view';
  const chosenNodes = nodes.filter((node) => node.selected);
  const chosenEdges = edges.filter((edge) => edge.selected);
  const chosenSteps = chosenNodes.filter((node) => node.type !== 'group');
  const actionReady = {
    one: chosenNodes.length + chosenEdges.length === 1,
    steps: chosenSteps.length > 0,
    any: chosenNodes.length + chosenEdges.length > 0,
    undo: historySize.undo > 0,
    redo: historySize.redo > 0
  };

  const arrange = (kind) => {
    const steps = nodes.filter((node) => node.type !== 'group' && !node.parentId);
    if (steps.length === 0) return;
    const ids = new Set(steps.map((node) => node.id));
    const wires = edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
    const place = new Map();
    if (kind === 'lr' || kind === 'tb') {
      const level = flowLevels(steps.map((node) => node.id), wires);
      const rows = new Map();
      for (const node of steps) {
        const along = level.get(node.id);
        const beside = rows.get(along) || 0;
        rows.set(along, beside + 1);
        place.set(node.id, kind === 'lr' ? { x: along * 240, y: beside * 110 } : { x: beside * 240, y: along * 130 });
      }
    }
    if (kind === 'grid') {
      const columns = Math.ceil(Math.sqrt(steps.length));
      steps.forEach((node, index) => place.set(node.id, { x: (index % columns) * 240, y: Math.floor(index / columns) * 110 }));
    }
    if (kind === 'circle') {
      const radius = Math.max(160, steps.length * 45);
      steps.forEach((node, index) => {
        const angle = (index / steps.length) * 2 * Math.PI - Math.PI / 2;
        place.set(node.id, { x: Math.round(radius + radius * Math.cos(angle)), y: Math.round(radius + radius * Math.sin(angle)) });
      });
    }
    setNodes((current) => current.map((node) => (place.has(node.id) ? { ...node, position: place.get(node.id) } : node)));
    if (kind === 'lr' || kind === 'tb') {
      const [from, to] = kind === 'lr' ? ['right-source', 'left-target'] : ['bottom-source', 'top-target'];
      setEdges((current) => current.map((edge) => (ids.has(edge.source) && ids.has(edge.target) ? { ...edge, sourceHandle: from, targetHandle: to } : edge)));
    }
    setTimeout(() => reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 200 }), 50);
  };

  const alignChosen = (how) => {
    const picked = nodes.filter((node) => node.selected && node.type !== 'group');
    if (picked.length < 2) return;
    const place = new Map();
    if (how === 'left') picked.forEach((node) => place.set(node.id, { ...node.position, x: Math.min(...picked.map((each) => each.position.x)) }));
    if (how === 'top') picked.forEach((node) => place.set(node.id, { ...node.position, y: Math.min(...picked.map((each) => each.position.y)) }));
    if (how === 'across' || how === 'down') {
      const axis = how === 'across' ? 'x' : 'y';
      const sorted = [...picked].sort((a, b) => a.position[axis] - b.position[axis]);
      const first = sorted[0].position[axis];
      const gap = (sorted[sorted.length - 1].position[axis] - first) / (sorted.length - 1);
      sorted.forEach((node, index) => place.set(node.id, { ...node.position, [axis]: Math.round(first + gap * index) }));
    }
    setNodes((current) => current.map((node) => (place.has(node.id) ? { ...node, position: place.get(node.id) } : node)));
  };

  const runAction = (id) => {
    const instance = reactFlowInstanceRef.current;
    if (id === 'tidyDown') {
      if (canEdit) arrange('tb');
      return;
    }
    const action = FLOW_ACTIONS.find((entry) => entry.id === id);
    if (!action || (action.kind === 'edit' && !canEdit) || (action.needs && !actionReady[action.needs])) return;
    if (id === 'step') addBox('node');
    if (id === 'group') addBox('group');
    if (id === 'zoomIn') instance?.zoomIn({ duration: 150 });
    if (id === 'zoomOut') instance?.zoomOut({ duration: 150 });
    if (id === 'fit') instance?.fitView({ padding: 0.2, duration: 200 });
    if (id === 'lock') setLocked((now) => !now);
    if (id === 'map') setMapShown((now) => !now);
    if (id === 'undo') stepBack('past', 'future');
    if (id === 'redo') stepBack('future', 'past');
    if (id === 'delete') instance?.deleteElements({ nodes: chosenNodes, edges: chosenEdges });
    if (id === 'tidy') arrange('lr');
    if (id === 'snap') setSnap((now) => !now);
    if (id === 'selectAll') {
      setNodes((current) => current.map((node) => ({ ...node, selected: true })));
      setEdges((current) => current.map((edge) => ({ ...edge, selected: true })));
    }
    if (id === 'duplicate') {
      setNodes((current) => {
        const taken = new Set(current.map((node) => node.id));
        const copies = chosenSteps.map((node) => {
          let number = 2;
          while (taken.has(`${node.id}-${number}`)) number++;
          taken.add(`${node.id}-${number}`);
          return { ...node, id: `${node.id}-${number}`, position: { x: node.position.x + 24, y: node.position.y + 24 }, data: { ...node.data }, selected: true };
        });
        return [...current.map((node) => (node.selected ? { ...node, selected: false } : node)), ...copies];
      });
    }
    if (id === 'edit') {
      const box = containerRef.current?.getBoundingClientRect();
      const target = chosenNodes[0] || chosenEdges[0];
      const drawn = containerRef.current?.querySelector(`[data-id="${CSS.escape(target.id)}"]`)?.getBoundingClientRect();
      const at = { clientX: drawn ? drawn.left + drawn.width / 2 : (box?.left ?? 0) + (box?.width ?? 0) / 2, clientY: drawn ? drawn.bottom : (box?.top ?? 0) + (box?.height ?? 0) / 2, preventDefault: () => {} };
      if (chosenNodes[0]) onContextMenu(at, target);
      else onEdgeContextMenuHandler(at, target);
    }
  };
  const runActionRef = useRef(runAction);
  runActionRef.current = runAction;

  // Keyboard shortcuts work while the pointer is over the flow or something inside it has focus.
  useEffect(() => {
    if (toolbar === false) return undefined;
    const onKey = (event) => {
      const inside = hoverRef.current || containerRef.current?.contains(document.activeElement);
      const typing = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
      if (!inside || typing || event.altKey) return;
      const key = event.key.toLowerCase();
      const command = event.ctrlKey || event.metaKey;
      const id = command
        ? ({ a: 'selectAll', d: 'duplicate', z: event.shiftKey ? 'redo' : 'undo', y: 'redo' })[key]
        : ({ n: 'step', g: 'group', e: 'edit', l: event.shiftKey ? 'tidyDown' : 'tidy', s: 'snap', f: 'fit', k: 'lock', m: 'map', '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut' })[key];
      if (!id) return;
      event.preventDefault();
      runActionRef.current(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolbar]);

  // Dropping a step on a group puts it in that group; dragging it out takes it out.
  const onNodeDragStopHandler = useCallback((_event, _node, dragged = []) => {
    const instance = reactFlowInstanceRef.current;
    if (!instance?.getInternalNode) return;
    const groups = instance.getNodes().filter((node) => node.type === 'group');
    const moves = new Map();
    for (const item of dragged) {
      if (item.type === 'group') continue;
      const inner = instance.getInternalNode(item.id);
      const at = inner?.internals?.positionAbsolute;
      if (!at) continue;
      const middle = { x: at.x + (inner.measured?.width ?? 120) / 2, y: at.y + (inner.measured?.height ?? 48) / 2 };
      const home = groups.find((group) => {
        const wide = group.measured?.width ?? group.width ?? group.style?.width ?? 300;
        const tall = group.measured?.height ?? group.height ?? group.style?.height ?? 200;
        return middle.x >= group.position.x && middle.x <= group.position.x + wide && middle.y >= group.position.y && middle.y <= group.position.y + tall;
      });
      if ((home?.id || null) === (item.parentId || null)) continue;
      moves.set(item.id, home
        ? { parentId: home.id, position: { x: Math.round(at.x - home.position.x), y: Math.round(at.y - home.position.y) } }
        : { parentId: null, position: { x: Math.round(at.x), y: Math.round(at.y) } });
    }
    if (moves.size === 0) return;
    setNodes((current) => current.map((node) => {
      const move = moves.get(node.id);
      if (!move) return node;
      const { parentId: _parent, extent: _extent, expandParent: _expand, ...rest } = node;
      return { ...rest, position: move.position, ...(move.parentId ? { parentId: move.parentId } : {}) };
    }));
  }, [setNodes]);

  const onPaneClickHandler = useCallback((e) => {
    setNodeEditor(null);
    setEdgeEditor(null);
    if (enableNodeCreation && !readOnly) {
      const keyMatch = !nodeCreationKey || nodeCreationKey === 'none' ||
        (nodeCreationKey === 'ctrl' && (e.ctrlKey || e.metaKey)) ||
        (nodeCreationKey === 'alt' && e.altKey);
      
      if (keyMatch) {
        const instance = reactFlowInstanceRef.current;
        let position = null;

        if (instance && typeof instance.screenToFlowPosition === 'function') {
          position = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        } else if (instance && typeof instance.project === 'function') {
          position = instance.project({ x: e.clientX, y: e.clientY });
        }

        if (!position) {
          const bounds = e.currentTarget.getBoundingClientRect();
          position = {
            x: e.clientX - bounds.left,
            y: e.clientY - bounds.top
          };
        }
        
        const shape = defaultNodeData?.shape || DEFAULT_NODE_SHAPE;
        const colorToken = resolveColorToken(defaultNodeData?.color || defaultNodeData?.colorToken, DEFAULT_NODE_COLOR_TOKEN);
        const cleanedStyle = stripNodeColorStyle(defaultNodeStyle);

        setNodes((nds) => {
          const newNode = {
            id: `node-${Date.now()}`,
            type: 'editable',
            position,
            data: { ...defaultNodeData, shape, color: colorToken }
          };
          if (cleanedStyle && Object.keys(cleanedStyle).length) {
            newNode.style = cleanedStyle;
          }
          return [...nds, newNode];
        });
      }
    }
    onPaneClick?.(e);
  }, [enableNodeCreation, readOnly, nodeCreationKey, defaultNodeData, defaultNodeStyle, setNodes, onPaneClick]);

  const handleInit = useCallback((instance) => {
    reactFlowInstanceRef.current = instance;
    onInit?.(instance);
  }, [onInit]);

  // Screen size detection - Flow only works on larger screens (tablets and above)
  const [isLargeScreen, setIsLargeScreen] = useState(true);
  
  useEffect(() => {
    const checkScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      onMouseEnter={() => { hoverRef.current = true; }}
      onMouseLeave={() => { hoverRef.current = false; }}
      className={`flow-container themed-flow flow-${size} ${connecting ? 'flow-connecting' : ''} ${theme ? `theme-${theme}` : ''} ${className}`.trim()}
      style={containerStyle}
      data-theme={theme || currentTheme}
    >
      {!isLargeScreen ? (
        <Container 
          layout="flex" 
          align="center" 
          justify="center" 
          padding="xl"
          width="100%"
          height="100%"
          minHeight={containerStyle.minHeight}
        >
          <Card 
            padding="xl" 
            layout="flex-column" 
            align="center" 
            justify="center" 
            gap="lg"
            maxWidth="500px"
            backgroundColor="surface"
          >
            <Icon name="FiMonitor" size="xl" color="warning" />
            <Typography variant="h3" size="lg" weight="bold" align="center" color="warning">
              Tablet or Desktop View Required
            </Typography>
            <Typography size="md" align="center" color="muted">
              Flow diagrams are optimized for larger screens and require a tablet or desktop device to view and interact with.
            </Typography>
            <Typography size="sm" align="center" color="muted">
              Please switch to a device with a screen width of at least 768px to view this content.
            </Typography>
            <Container layout="flex" gap="sm" align="center" marginTop="md">
              <Icon name="FiInfo" size="sm" color="primary" />
              <Typography size="xs" color="muted">
                Current screen width: {window.innerWidth}px
              </Typography>
            </Container>
          </Card>
        </Container>
      ) : (
        <>
      <div
        ref={anchorRef}
        style={{
          position: 'absolute',
          left: `${nodeEditor?.x ?? 0}px`,
          top: `${nodeEditor?.y ?? 0}px`,
          width: 0,
          height: 0,
          pointerEvents: 'none'
        }}
      />
      
      <div
        ref={edgeAnchorRef}
        style={{
          position: 'absolute',
          left: `${edgeEditor?.x ?? 0}px`,
          top: `${edgeEditor?.y ?? 0}px`,
          width: 0,
          height: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Node Editor Genie */}
      <Genie visible={Boolean(nodeEditor)} triggerRef={anchorRef} onClose={() => setNodeEditor(null)} variant="menu" animation="scale" layout="flex-column" padding="md" width="280px">
        {nodeEditor?.nodeType === 'group' ? (
          <Container layout="flex-column" gap="sm" padding="none" width="100%">
            <Typography size="sm" weight="semibold">Edit Group</Typography>
            <Typography size="xs">Update group label and background.</Typography>
            <Input 
              label="Label" 
              value={nodeEditor?.label ?? ''} 
              onChange={(e) => setNodeEditor((s) => s ? { ...s, label: e.target.value } : s)} 
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveNode())} 
              size="sm" 
              width="100%" 
            />
            <Select
              label="Background Color"
              value={nodeEditor?.color ?? DEFAULT_NODE_COLOR_TOKEN}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, color: value } : s))}
              size="sm"
              width="100%"
              options={COLOR_OPTIONS}
            />
            <ButtonGroup spaced selectable={false} justify="end">
              <Button size="sm" color="secondary" onClick={() => setNodeEditor(null)}>Cancel</Button>
              <Button size="sm" color="primary" onClick={saveNode}>Save</Button>
            </ButtonGroup>
          </Container>
        ) : (
          <Container layout="flex-column" gap="sm" padding="none" width="100%">
            <Typography size="sm" weight="semibold">Edit Node</Typography>
            <Typography size="xs">Update label, color, and shape. Press Enter to save.</Typography>
            <Input 
              label="Label" 
              value={nodeEditor?.label ?? ''} 
              onChange={(e) => setNodeEditor((s) => s ? { ...s, label: e.target.value } : s)} 
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveNode())} 
              size="sm" 
              width="100%" 
            />
            <Select
              label="Color"
              value={nodeEditor?.color ?? DEFAULT_NODE_COLOR_TOKEN}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, color: value } : s))}
              size="sm"
              width="100%"
              options={COLOR_OPTIONS}
            />
            <Select
              label="Shape"
              value={nodeEditor?.shape ?? DEFAULT_NODE_SHAPE}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, shape: value } : s))}
              size="sm"
              width="100%"
              options={NODE_SHAPE_OPTIONS}
            />
            <Select
              label="Font Size"
              value={nodeEditor?.fontSize ?? 'md'}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, fontSize: value } : s))}
              size="sm"
              width="100%"
              options={[
                { value: 'xs', label: 'Extra Small' },
                { value: 'sm', label: 'Small' },
                { value: 'md', label: 'Medium' },
                { value: 'lg', label: 'Large' },
                { value: 'xl', label: 'Extra Large' },
                { value: '2xl', label: '2X Large' }
              ]}
            />
            <Select
              label="Node Type"
              value={nodeEditor?.nodeType ?? 'editable'}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, nodeType: value } : s))}
              size="sm"
              width="100%"
              options={[
                { value: 'editable', label: 'Editable Node' },
                { value: 'group', label: 'Group (Subflow)' }
              ]}
            />
            <Select
              label="Parent Node (Optional)"
              value={nodeEditor?.parentId ?? ''}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, parentId: value, extent: value ? 'parent' : undefined } : s))}
              size="sm"
              width="100%"
              options={[
                { value: '', label: 'None (Top Level)' },
                ...(nodes
                  .filter(n => n.id !== nodeEditor?.nodeId && (n.type === 'group' || n.data?.shape === 'group'))
                  .map(n => ({ value: n.id, label: n.data?.label || n.id }))
                )
              ]}
            />
            {nodeEditor?.parentId && (
              <Select
                label="Movement Constraint"
                value={nodeEditor?.extent ?? 'parent'}
                onChange={(value) => setNodeEditor((s) => (s ? { ...s, extent: value } : s))}
                size="sm"
                width="100%"
                options={[
                  { value: 'parent', label: 'Constrained to Parent' },
                  { value: '', label: 'Free Movement' }
                ]}
              />
            )}
            <Select
              label="Font Weight"
              value={nodeEditor?.fontWeight ?? 'semibold'}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, fontWeight: value } : s))}
              size="sm"
              width="100%"
              options={[
                { value: 'light', label: 'Light' },
                { value: 'normal', label: 'Normal' },
                { value: 'medium', label: 'Medium' },
                { value: 'semibold', label: 'Semibold' },
                { value: 'bold', label: 'Bold' },
                { value: 'extrabold', label: 'Extra Bold' }
              ]}
            />
            <Select
              label="Text Align"
              value={nodeEditor?.textAlign ?? 'center'}
              onChange={(value) => setNodeEditor((s) => (s ? { ...s, textAlign: value } : s))}
              size="sm"
              width="100%"
              options={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' }
              ]}
            />
            <div className="flow-node-preview">
              <div
                className={`flow-node-surface ${getNodeColorClass(nodeEditor?.color ?? DEFAULT_NODE_COLOR_TOKEN)}`}
                data-shape={nodeEditor?.shape ?? DEFAULT_NODE_SHAPE}
                data-color={nodeEditor?.color ?? DEFAULT_NODE_COLOR_TOKEN}
                data-font-size={nodeEditor?.fontSize ?? 'md'}
                data-font-weight={nodeEditor?.fontWeight ?? 'semibold'}
                data-text-align={nodeEditor?.textAlign ?? 'center'}
              >
                <div className="flow-node-geometry" aria-hidden="true" />
                <span className="flow-node-label">{nodeEditor?.label || 'Preview'}</span>
              </div>
            </div>
            <ButtonGroup spaced selectable={false} justify="end">
              <Button size="sm" color="secondary" onClick={() => setNodeEditor(null)}>Cancel</Button>
              <Button size="sm" color="primary" onClick={saveNode}>Save</Button>
            </ButtonGroup>
          </Container>
        )}
      </Genie>

      {/* Edge Editor Genie */}
      <Genie visible={Boolean(edgeEditor)} triggerRef={edgeAnchorRef} onClose={() => setEdgeEditor(null)} variant="menu" animation="scale" layout="flex-column" padding="md" width="300px">
        <Container layout="flex-column" gap="sm" padding="none" width="100%">
          <Typography size="sm" weight="semibold">Edit Connector</Typography>
          <Typography size="xs">Customize connector appearance and style.</Typography>
          
          <Input 
            label="Label (optional)" 
            value={edgeEditor?.label ?? ''} 
            onChange={(e) => setEdgeEditor((s) => s ? { ...s, label: e.target.value } : s)} 
            size="sm" 
            width="100%" 
            placeholder="Add text label"
          />
          
          <Select 
            label="Connector Type" 
            value={edgeEditor?.type ?? 'smoothstep'}
            onChange={(value) => setEdgeEditor((s) => s ? { ...s, type: value } : s)}
            size="sm"
            width="100%"
            options={[
              { value: 'smoothstep', label: 'Smooth Step' },
              { value: 'straight', label: 'Straight' },
              { value: 'default', label: 'Bezier Curve' },
              { value: 'step', label: 'Step' },
              { value: 'simplebezier', label: 'Simple Bezier' }
            ]}
          />
          
          <Select 
            label="Arrow Style" 
            value={edgeEditor?.markerEnd ?? 'arrowclosed'}
            onChange={(value) => setEdgeEditor((s) => s ? { ...s, markerEnd: value } : s)}
            size="sm"
            width="100%"
            options={[
              { value: 'arrowclosed', label: 'Filled Arrow' },
              { value: 'arrow', label: 'Open Arrow' },
              { value: '', label: 'No Arrow' }
            ]}
          />
          
          <Container layout="flex" gap="sm" padding="none" width="100%">
            <Select
              label="Color"
              value={edgeEditor?.color ?? DEFAULT_EDGE_COLOR_TOKEN}
              onChange={(value) => setEdgeEditor((s) => (s ? { ...s, color: value } : s))}
              size="sm"
              width="50%"
              options={COLOR_OPTIONS}
            />
            <Input 
              type="number" 
              label="Width" 
              value={edgeEditor?.strokeWidth ?? 2} 
              onChange={(e) => setEdgeEditor((s) => s ? { ...s, strokeWidth: parseInt(e.target.value) || 2 } : s)} 
              size="sm" 
              width="50%"
              min="1"
              max="10"
            />
          </Container>
          
          <Container layout="flex" align="center" gap="sm" padding="none" width="100%">
            <input
              type="checkbox"
              id="edge-animated"
              checked={edgeEditor?.animated ?? true}
              onChange={(e) => setEdgeEditor((s) => s ? { ...s, animated: e.target.checked } : s)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="edge-animated" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
              Animated (moving dashes)
            </label>
          </Container>
          
          <div 
            className="flow-edge-preview" 
            style={{ 
              marginTop: '8px',
              padding: '12px',
              borderRadius: '4px',
              background: 'var(--surface-color)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              height: '40px'
            }}
          >
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
              <line
                x1="10%"
                y1="50%"
                x2="90%"
                y2="50%"
                stroke={getColorVariable(edgeEditor?.color ?? DEFAULT_EDGE_COLOR_TOKEN, DEFAULT_EDGE_COLOR_TOKEN)}
                strokeWidth={edgeEditor?.strokeWidth || 2}
                strokeDasharray={edgeEditor?.animated ? '5,5' : '0'}
                markerEnd={edgeEditor?.markerEnd ? 'url(#preview-arrow)' : ''}
              />
              <defs>
                <marker
                  id="preview-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path
                    d="M 0 0 L 10 5 L 0 10 z"
                    fill={getColorVariable(edgeEditor?.color ?? DEFAULT_EDGE_COLOR_TOKEN, DEFAULT_EDGE_COLOR_TOKEN)}
                  />
                </marker>
              </defs>
            </svg>
          </div>
          
          <ButtonGroup spaced selectable={false} justify="end">
            <Button size="sm" color="secondary" onClick={() => setEdgeEditor(null)}>Cancel</Button>
            <Button size="sm" color="primary" onClick={saveEdge}>Save</Button>
          </ButtonGroup>
        </Container>
      </Genie>

      <FlowLock.Provider value={readOnly}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={connectable && !readOnly ? onConnect : undefined}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        edgesReconnectable={connectable && !readOnly}
        onReconnect={(oldEdge, connection) => setEdges((current) => reconnectEdge(oldEdge, connection, current).map(sanitizeEdge))}
        snapToGrid={snap}
        snapGrid={[backgroundGap, backgroundGap]}
        onNodeClick={(e, node) => { setNodeEditor(null); setEdgeEditor(null); onNodeClick?.(e, node); }}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onContextMenu}
        onEdgeClick={(e, edge) => { setNodeEditor(null); setEdgeEditor(null); onEdgeClick?.(e, edge); }}
        onEdgeContextMenu={onEdgeContextMenuHandler}
        onPaneClick={onPaneClickHandler}
        onNodeDragStop={readOnly ? undefined : onNodeDragStopHandler}
        nodesDraggable={draggable && !readOnly && !locked}
        nodesConnectable={connectable && !readOnly}
        elementsSelectable={selectable}
        deleteKeyCode={deletable && !readOnly ? ['Backspace', 'Delete'] : null}
        zoomOnScroll={zoomable}
        panOnScroll={pannable}
        fitView={fitView}
        fitViewOptions={fitViewOptions}
  proOptions={proOptions}
  onInit={handleInit}
        {...reactFlowProps}
      >
        {background && <Background variant={backgroundVariant} gap={backgroundGap} size={backgroundSize} {...backgroundProps} />}
        {controls && toolbar === false && <Controls showInteractive={!readOnly} {...controlsProps} />}
        {toolbar !== false && (
          <Panel position="top-left" className="flow-toolbar">
            <ButtonGroup vertical selectable={false} size="sm">
              {FLOW_ACTIONS.filter((action) => action.kind === 'view' || canEdit).map((action) => (
                <Button
                  key={action.id}
                  size="sm"
                  variant="ghost"
                  selected={(action.id === 'lock' && locked) || (action.id === 'map' && mapShown) || (action.id === 'snap' && snap)}
                  genie={action.id !== 'tidy' ? null : { trigger: 'click', padding: 'xs', content: (
                    <Container layout="flex-column" gap="xs" padding="none">
                      <ButtonGroup selectable={false} size="xs">
                        {FLOW_LAYOUTS.map((layout) => (
                          <Button key={layout.id} size="xs" variant="ghost" title={layout.label} onClick={() => arrange(layout.id)}>
                            <Icon name={layout.icon} size="xs" />
                          </Button>
                        ))}
                      </ButtonGroup>
                      <ButtonGroup selectable={false} size="xs">
                        {FLOW_ALIGNMENTS.map((alignment) => (
                          <Button key={alignment.id} size="xs" variant="ghost" title={alignment.label} disabled={chosenSteps.length < alignment.least} onClick={() => alignChosen(alignment.id)}>
                            <Icon name={alignment.icon} size="xs" />
                          </Button>
                        ))}
                      </ButtonGroup>
                    </Container>
                  ) }}
                  disabled={Boolean(action.needs) && !actionReady[action.needs]}
                  title={`${action.label} (${action.keys})`}
                  aria-label={`${action.label} (${action.keys})`}
                  onClick={() => { if (action.id !== 'tidy') runAction(action.id); }}
                >
                  <Icon name={action.icon} size="xs" />
                </Button>
              ))}
            </ButtonGroup>
          </Panel>
        )}
        {mapShown && (
          <MiniMap
            zoomable
            pannable
            nodeStrokeWidth={3}
            nodeColor={(n) => getColorVariable(inferNodeColorToken(n))}
            {...minimapProps}
          />
        )}
      </ReactFlow>
      </FlowLock.Provider>
      </>
      )}
    </div>
  );
};

export default Flow;
