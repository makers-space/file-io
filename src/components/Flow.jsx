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

import React, { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  Position,
  NodeResizer,
  NodeToolbar,
  EdgeToolbar,
  EdgeLabelRenderer,
  ReactFlowProvider,
  ConnectionMode,
  SelectionMode,
  useNodesInitialized,
  BaseEdge,
  getStraightPath,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  useInternalNode,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { UndoRedo, Separator, BoldItalicUnderlineToggles, BlockTypeSelect, ListsToggle, CreateLink } from '@mdxeditor/editor';
import { Editor } from './Editor';
import { useTheme } from '../contexts/ThemeContext';
import Genie from './Genie';
import { Input } from './Input';
import { Button } from './Button';
import { ButtonGroup } from './ButtonGroup';
import { Container } from './Container';
import { Typography } from './Typography';
import { Select } from './Select';
import { Switch } from './Switch';
import { Icon } from './Icon';
import { Card } from './Card';

const DEFAULT_NODE_SHAPE = 'rectangle';
const DEFAULT_NODE_COLOR_TOKEN = 'primary';
const DEFAULT_EDGE_COLOR_TOKEN = 'primary';
const NEW_EDGE_COLOR_TOKEN = 'secondary';

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
    markerEnd: buildMarkerEnd(edge.markerEnd, colorToken),
    markerStart: buildMarkerEnd(edge.markerStart, colorToken)
  };
};

// ===== Flow text =====
// A flow is kept as plain text: <Flow> holding <Group />, <Node /> and <Edge /> lines.
// parseFlow turns that text into nodes and edges; writeFlow turns nodes and edges back into the same text.
export const FLOW_LIMITS = { nodes: 500, edges: 1000, text: 4000 };
const FLOW_DASHES = '6 5';

const FLOW_TAG = /<\s*(Node|Group|Edge)\b((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/\s*>|>([^<]*)<\/\s*\1\s*>|>)/gi;
const FLOW_ATTRIBUTE = /([A-Za-z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'>/]+))/g;
const FLOW_NODE_KEYS = ['id', 'label', 'color', 'shape', 'x', 'y', 'width', 'height', 'group', 'size', 'weight', 'align', 'locked', 'collapsible', 'collapsed'];
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
  const leads = new Map(ids.map((id) => [id, []]));
  for (const { source, target } of wires) {
    if (source !== target && leads.has(source) && leads.has(target)) leads.get(source).push(target);
  }
  // Walking the connectors from each box, one that leads back to a box still being walked closes a loop.
  const state = new Map();
  const forward = [];
  const walk = (id) => {
    state.set(id, 'open');
    for (const next of leads.get(id)) {
      if (state.get(next) === 'open') continue;
      forward.push({ source: id, target: next });
      if (!state.has(next)) walk(next);
    }
    state.set(id, 'done');
  };
  for (const id of ids) {
    if (!state.has(id)) walk(id);
  }
  for (let pass = 0; pass < ids.length; pass++) {
    let moved = false;
    for (const { source, target } of forward) {
      if (level.get(target) <= level.get(source) && level.get(source) < ids.length) {
        level.set(target, level.get(source) + 1);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return level;
};

const layoutLinked = (items, wires, kind) => {
  const place = new Map();
  if (items.length === 0) return place;
  const typical = (measure) => {
    const sorted = items.map(measure).sort((one, other) => one - other);
    return sorted[Math.floor(sorted.length / 2)];
  };
  const usualWide = typical((item) => item.wide);
  const usualTall = typical((item) => item.tall);
  // Boxes given by their middles: any two closer than the margin are pushed apart the shorter way, until none are.
  const spread = (boxes, margin) => {
    for (let round = 0; round < 400; round++) {
      let moved = false;
      for (let one = 0; one < boxes.length; one++) {
        for (let other = one + 1; other < boxes.length; other++) {
          const a = boxes[one];
          const b = boxes[other];
          const overX = (a.wide + b.wide) / 2 + margin - Math.abs(b.x - a.x);
          const overY = (a.tall + b.tall) / 2 + margin - Math.abs(b.y - a.y);
          if (overX <= 0 || overY <= 0) continue;
          moved = true;
          if (overX < overY) {
            const push = (overX / 2 + 0.5) * (b.x >= a.x ? 1 : -1);
            a.x -= push;
            b.x += push;
          } else {
            const push = (overY / 2 + 0.5) * (b.y >= a.y ? 1 : -1);
            a.y -= push;
            b.y += push;
          }
        }
      }
      if (!moved) break;
    }
  };
  if (kind === 'lr' || kind === 'tb') {
    // Boxes are put in lines by how far along the connectors they sit. Within a line they are ordered, then
    // slid, to sit as near as they can to the boxes they connect to, which keeps connectors short and stops
    // most of them crossing. "across" is the direction along a line; "depth" is the direction from line to line.
    const level = flowLevels(items.map((item) => item.id), wires);
    // A connector that skips one or more lines gets a small placeholder in each line it passes. The placeholders
    // are ordered and spaced like boxes, so the boxes in those lines leave the connector a gap to run through.
    const all = [...items];
    const links = [];
    wires.forEach((wire, count) => {
      const from = level.get(wire.source);
      const to = level.get(wire.target);
      if (from === undefined || to === undefined || to - from < 2) {
        links.push(wire);
        return;
      }
      let last = wire.source;
      for (let at = from + 1; at < to; at++) {
        const id = `~${count}-${at}`;
        all.push({ id, wide: 28, tall: 28, placeholder: true });
        level.set(id, at);
        links.push({ source: last, target: id });
        last = id;
      }
      links.push({ source: last, target: wire.target });
    });
    const lines = [];
    for (const item of all) (lines[level.get(item.id)] ||= []).push(item);
    const rows = lines.filter(Boolean);
    const across = (item) => (kind === 'lr' ? item.tall : item.wide);
    const depth = (item) => (kind === 'lr' ? item.wide : item.tall);
    const gap = kind === 'lr' ? 68 : 88;

    const linked = new Map(all.map((item) => [item.id, new Set()]));
    for (const { source, target } of links) {
      linked.get(source)?.add(target);
      linked.get(target)?.add(source);
    }
    const row = new Map();
    rows.forEach((line, index) => line.forEach((item) => row.set(item.id, index)));
    const middle = new Map();
    const spread = (line) => {
      let at = 0;
      for (const item of line) {
        middle.set(item.id, at + across(item) / 2);
        at += across(item) + gap;
      }
    };
    const pull = (item, towards) => {
      const near = [...linked.get(item.id)].filter((id) => row.get(id) === towards);
      return near.length ? near.reduce((sum, id) => sum + middle.get(id), 0) / near.length : null;
    };
    rows.forEach(spread);

    // Ordering: a few passes down and back up, each line sorted by where its neighbours in the line before sit.
    for (let pass = 0; pass < 4; pass++) {
      const down = pass % 2 === 0;
      for (let index = down ? 1 : rows.length - 2; down ? index < rows.length : index >= 0; index += down ? 1 : -1) {
        const wanted = new Map(rows[index].map((item) => [item.id, pull(item, down ? index - 1 : index + 1) ?? middle.get(item.id)]));
        rows[index].sort((one, other) => wanted.get(one.id) - wanted.get(other.id));
        spread(rows[index]);
      }
    }

    // Sliding: each box moves towards the middle of its neighbours without overlapping the box before it.
    const slide = (line, towards) => {
      let free = -Infinity;
      for (const item of line) {
        const wanted = pull(item, towards) ?? middle.get(item.id);
        const start = Math.max(wanted - across(item) / 2, free);
        middle.set(item.id, start + across(item) / 2);
        free = start + across(item) + gap;
      }
    };
    for (let index = 1; index < rows.length; index++) slide(rows[index], index - 1);
    for (let index = rows.length - 2; index >= 0; index--) slide(rows[index], index + 1);
    for (let index = 1; index < rows.length; index++) slide(rows[index], index - 1);

    const least = Math.min(...all.map((item) => middle.get(item.id) - across(item) / 2));
    let along = 0;
    for (const line of rows) {
      const deepest = Math.max(...line.map(depth));
      for (const item of line) {
        const beside = Math.round(middle.get(item.id) - across(item) / 2 - least);
        const inset = Math.round(along + (deepest - depth(item)) / 2);
        if (!item.placeholder) place.set(item.id, kind === 'lr' ? { x: inset, y: beside } : { x: beside, y: inset });
      }
      along += deepest + (kind === 'lr' ? 132 : 104);
    }
  }
  // For a grid or a circle, boxes are taken in the order the connectors lead from one to the next,
  // so connected boxes end up beside each other.
  const chained = () => {
    const linked = new Map(items.map((item) => [item.id, []]));
    for (const { source, target } of wires) {
      linked.get(source)?.push(target);
      linked.get(target)?.push(source);
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    const seen = new Set();
    const order = [];
    const visit = (id) => {
      if (seen.has(id) || !byId.has(id)) return;
      seen.add(id);
      order.push(byId.get(id));
      linked.get(id).forEach(visit);
    };
    items.forEach((item) => visit(item.id));
    return order;
  };
  // Given boxes and the spots they may sit on, decides which box takes which spot.
  const settle = (order, spots) => {
    // The spots are fixed; which box sits on which is then improved. Two boxes swap places whenever that makes the
    // connectors shorter in total, until no swap helps. Short connectors are what keeps them from tangling.
    const seat = new Map(order.map((item, index) => [item.id, index]));
    const pairs = wires.filter((wire) => wire.source !== wire.target && seat.has(wire.source) && seat.has(wire.target));
    const span = (wire) => Math.hypot(spots[seat.get(wire.source)].x - spots[seat.get(wire.target)].x, spots[seat.get(wire.source)].y - spots[seat.get(wire.target)].y);
    const touching = new Map(order.map((item) => [item.id, pairs.filter((wire) => wire.source === item.id || wire.target === item.id)]));
    const strain = (one, other) => [...new Set([...touching.get(one), ...touching.get(other)])].reduce((sum, wire) => sum + span(wire), 0);
    if (order.length <= 120) {
      for (let pass = 0; pass < 12; pass++) {
        let better = false;
        for (let one = 0; one < order.length; one++) {
          for (let other = one + 1; other < order.length; other++) {
            const first = order[one].id;
            const second = order[other].id;
            const before = strain(first, second);
            const [here, there] = [seat.get(first), seat.get(second)];
            seat.set(first, there);
            seat.set(second, here);
            if (strain(first, second) < before - 0.5) {
              better = true;
            } else {
              seat.set(first, here);
              seat.set(second, there);
            }
          }
        }
        if (!better) break;
      }
    }
    const boxes = order.map((item) => ({ item, x: spots[seat.get(item.id)].x, y: spots[seat.get(item.id)].y, wide: item.wide, tall: item.tall }));
    spread(boxes, 56);
    for (const box of boxes) {
      place.set(box.item.id, { x: Math.round(box.x - box.wide / 2), y: Math.round(box.y - box.tall / 2) });
    }
  };
  // A grid's rows and columns are only where boxes may sit; which box goes where follows the connectors.
  if (kind === 'grid') {
    const columns = Math.ceil(Math.sqrt(items.length));
    const order = chained();
    settle(order, order.map((_item, index) => ({ x: (index % columns) * (usualWide + 100), y: Math.floor(index / columns) * (usualTall + 88) })));
  }
  // A circular arrangement that wastes no space: the most connected box goes in the middle and the rest wind
  // outward round it, each box placed after the boxes it connects to, so connectors run round and outward.
  // The winding is measured in box-sized steps, wider than tall, so the rings sit as close as a grid would.
  if (kind === 'circle') {
    const linked = new Map(items.map((item) => [item.id, []]));
    for (const { source, target } of wires) {
      if (source === target) continue;
      linked.get(source)?.push(target);
      linked.get(target)?.push(source);
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    const seen = new Set();
    const order = [];
    for (const first of [...items].sort((one, other) => linked.get(other.id).length - linked.get(one.id).length)) {
      if (seen.has(first.id)) continue;
      const waiting = [first.id];
      seen.add(first.id);
      while (waiting.length) {
        const id = waiting.shift();
        order.push(byId.get(id));
        for (const next of linked.get(id)) {
          if (seen.has(next) || !byId.has(next)) continue;
          seen.add(next);
          waiting.push(next);
        }
      }
    }
    const across = usualWide + 84;
    const down = usualTall + 88;
    let angle = -Math.PI / 2;
    const spots = order.map((_item, index) => {
      if (index === 0) return { x: 0, y: 0 };
      const reach = 1 + (angle + Math.PI / 2) / (2 * Math.PI);
      const spot = { x: reach * Math.cos(angle) * across, y: reach * Math.sin(angle) * down };
      angle += 1.1 / reach;
      return spot;
    });
    settle(order, spots);
  }
  // Every arrangement is handed back starting at the top-left corner. Whoever asked places it from there, and inside
  // a group nothing may sit left of or above the group's own corner.
  if (place.size > 0) {
    const left = Math.min(...[...place.values()].map((spot) => spot.x));
    const top = Math.min(...[...place.values()].map((spot) => spot.y));
    for (const spot of place.values()) {
      spot.x -= left;
      spot.y -= top;
    }
  }
  return place;
};

// Boxes that connectors join, directly or through others, are arranged as a set. Each set is then treated as one
// box, and the smaller sets, along with any boxes that connect to nothing, are spread round the largest.
const layoutItems = (items, wires, kind) => {
  const lead = new Map(items.map((item) => [item.id, item.id]));
  const find = (id) => {
    let at = id;
    while (lead.has(at) && lead.get(at) !== at) at = lead.get(at);
    return at;
  };
  for (const { source, target } of wires) {
    if (lead.has(source) && lead.has(target)) lead.set(find(source), find(target));
  }
  const sets = new Map();
  for (const item of items) sets.set(find(item.id), [...(sets.get(find(item.id)) || []), item]);
  if (sets.size <= 1 || sets.size === items.length) return layoutLinked(items, wires, kind);
  const room = 28;
  const parts = [...sets.entries()].map(([id, members]) => {
    const inner = layoutLinked(members, wires.filter((wire) => lead.has(wire.source) && lead.has(wire.target) && find(wire.source) === id), kind);
    return {
      id,
      members,
      inner,
      wide: Math.max(...members.map((member) => inner.get(member.id).x + member.wide)) + room * 2,
      tall: Math.max(...members.map((member) => inner.get(member.id).y + member.tall)) + room * 2
    };
  }).sort((one, other) => other.wide * other.tall - one.wide * one.tall);
  // The largest set sits in the middle; the rest are spaced evenly along a box drawn round it, on every side.
  const [core, ...rest] = parts;
  const wide = Math.max(...rest.map((part) => part.wide));
  const tall = Math.max(...rest.map((part) => part.tall));
  const grow = Math.max(0, rest.length * Math.max(wide, tall) * 1.5 - 2 * (core.wide + wide + core.tall + tall)) / 4;
  const across = core.wide + wide + grow;
  const down = core.tall + tall + grow;
  const outer = new Map([[core.id, { x: 0, y: 0 }]]);
  rest.forEach((part, index) => {
    const at = ((index + 0.5) / rest.length) * 2 * (across + down);
    const spot = at < across ? { x: at, y: 0 }
      : at < across + down ? { x: across, y: at - across }
        : at < across * 2 + down ? { x: across * 2 + down - at, y: down }
          : { x: 0, y: (across + down) * 2 - at };
    outer.set(part.id, {
      x: spot.x - (across - core.wide) / 2 - part.wide / 2,
      y: spot.y - (down - core.tall) / 2 - part.tall / 2
    });
  });
  const place = new Map();
  for (const part of parts) {
    for (const member of part.members) {
      place.set(member.id, {
        x: outer.get(part.id).x + room + part.inner.get(member.id).x,
        y: outer.get(part.id).y + room + part.inner.get(member.id).y
      });
    }
  }
  const left = Math.min(...[...place.values()].map((spot) => spot.x));
  const top = Math.min(...[...place.values()].map((spot) => spot.y));
  for (const spot of place.values()) {
    spot.x -= left;
    spot.y -= top;
  }
  return place;
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
    data: {
      label: props.label ?? '',
      color: resolveColorToken(props.color, 'neutral'),
      ...(props.locked === 'true' ? { locked: true } : {}),
      ...(props.collapsible === 'true' || props.collapsed === 'true' ? { collapsible: true } : {}),
      ...(props.collapsed === 'true' ? { collapsed: true } : {})
    },
    style: { width: flowNumber(props.width) ?? 300, height: flowNumber(props.height) ?? 200 }
  }));

  const steps = named.filter((box) => box.kind === 'node');
  const stepIds = new Set(steps.map((box) => box.props.id));
  const wires = links.filter(({ props }) => stepIds.has(props.source) && (stepIds.has(props.target) || groupIds.has(props.target)));
  const joined = new Map(wires.filter(({ props }) => groupIds.has(props.target)).map(({ props }) => [props.source, props.target]));

  // Boxes with no position are laid out left to right, following the connectors.
  const level = flowLevels(steps.map((box) => box.props.id), wires.map(({ props }) => props).filter((wire) => stepIds.has(wire.target)));
  const rows = new Map();
  const inGroup = new Map();

  const nodes = steps.map(({ props }) => {
    const parent = joined.get(props.id) || (groupIds.has(props.group) ? props.group : null);
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
    if (props.locked === 'true') data.locked = true;
    return {
      id: props.id,
      type: 'editable',
      position,
      data,
      ...(flowNumber(props.width) > 0 ? { width: flowNumber(props.width) } : {}),
      ...(flowNumber(props.height) > 0 ? { height: flowNumber(props.height) } : {}),
      ...(parent ? { parentId: parent, extent: 'parent', expandParent: true } : {})
    };
  });

  const edges = wires.filter(({ props }) => stepIds.has(props.target)).map(({ props }, index) => {
    const arrow = String(props.arrow ?? '').toLowerCase();
    const start = String(props.start ?? '').toLowerCase();
    const toGroup = groupIds.has(props.target);
    const side = oneOf(props.to, FLOW_SIDES) || 'left';
    return {
      id: `edge-${index}`,
      source: props.source,
      target: props.target,
      sourceHandle: `${oneOf(props.from, FLOW_SIDES) || (toGroup ? side : 'right')}`,
      targetHandle: toGroup ? 'border' : `${side}`,
      ...(props.label ? { label: props.label } : {}),
      type: toGroup ? 'member' : oneOf(props.type, FLOW_EDGE_TYPES) || 'smoothstep',
      animated: props.animated === 'true',
      data: {
        color: resolveColorToken(props.color, DEFAULT_EDGE_COLOR_TOKEN),
        ...(flowNumber(props.bend) !== null ? { bend: Math.min(Math.max(flowNumber(props.bend), 0), 100) / 100 } : {}),
        ...(flowNumber(props.corner) !== null ? { corner: Math.min(Math.max(flowNumber(props.corner), 0), 40) } : {}),
        ...(FLOW_LABEL_PX[props.labelsize] ? { labelSize: props.labelsize } : {}),
        ...(toGroup ? { side, along: Math.min(Math.max(flowNumber(props.at) ?? 50, 0), 100) / 100, line: oneOf(props.type, FLOW_EDGE_TYPES) || 'step', follow: props.color === undefined } : {})
      },
      style: { strokeWidth: Math.min(Math.max(flowNumber(props.width) ?? 2, 1), 10), ...(props.dashed === 'true' && props.animated !== 'true' ? { strokeDasharray: FLOW_DASHES } : {}) },
      ...(toGroup ? { zIndex: 10 } : {}),
      ...(arrow === 'none' ? {} : { markerEnd: { type: arrow === 'open' ? 'arrow' : 'arrowclosed' } }),
      ...(start === 'open' || start === 'filled' ? { markerStart: { type: start === 'open' ? 'arrow' : 'arrowclosed' } } : {}),
      ...(FLOW_LABEL_PX[props.labelsize] ? { labelStyle: { fontSize: FLOW_LABEL_PX[props.labelsize] } } : {}),
      ...(props.labelbg === 'false' ? { labelShowBg: false } : {})
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
      ['width', flowNumber(node.width ?? node.style?.width) ?? 300], ['height', flowNumber(node.height ?? node.style?.height) ?? 200],
      ['locked', node.data?.locked ? 'true' : null], ['collapsible', node.data?.collapsible ? 'true' : null], ['collapsed', node.data?.collapsed ? 'true' : null]
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
      ['width', flowNumber(node.width) > 0 ? flowNumber(node.width) : null], ['height', flowNumber(node.height) > 0 ? flowNumber(node.height) : null],
      ['locked', data.locked ? 'true' : null],
      ...details
    ]));
  }
  for (const edge of edges) {
    if (!stepIds.has(edge.source) || !stepIds.has(edge.target)) continue;
    const color = resolveColorToken(edge.data?.color, DEFAULT_EDGE_COLOR_TOKEN);
    const from = sideOf(edge.sourceHandle);
    const member = edge.type === 'member';
    const to = member ? oneOf(edge.data?.side, FLOW_SIDES) || 'left' : sideOf(edge.targetHandle);
    const along = member ? Math.round(Math.min(Math.max(edge.data?.along ?? 0.5, 0), 1) * 100) : null;
    const marker = typeof edge.markerEnd === 'string' ? edge.markerEnd : edge.markerEnd?.type;
    const startMarker = typeof edge.markerStart === 'string' ? edge.markerStart : edge.markerStart?.type;
    const curve = member ? edge.data?.line || 'step' : edge.type;
    const width = flowNumber(edge.style?.strokeWidth) ?? 2;
    lines.push(line('Edge', [
      ['source', edge.source], ['target', edge.target],
      ['label', typeof edge.label === 'string' ? edge.label : null],
      ['color', edge.type === 'member' ? (edge.data?.follow ? null : color) : (color === DEFAULT_EDGE_COLOR_TOKEN ? null : color)],
      ['type', curve && curve !== (member ? 'step' : 'smoothstep') ? curve : null],
      ['animated', edge.animated ? 'true' : null],
      ['dashed', !edge.animated && edge.style?.strokeDasharray ? 'true' : null],
      ['arrow', !marker ? 'none' : marker === 'arrow' ? 'open' : null],
      ['start', !startMarker ? null : startMarker === 'arrow' ? 'open' : 'filled'],
      ['width', width !== 2 ? width : null],
      ['from', from && from !== (member ? to : 'right') ? from : null],
      ['to', to && to !== 'left' ? to : null],
      ['at', member && along !== 50 ? along : null],
      ['bend', edge.data?.bend !== undefined && Math.round(edge.data.bend * 100) !== 25 ? Math.round(edge.data.bend * 100) : null],
      ['corner', edge.data?.corner !== undefined && edge.data.corner !== 5 ? edge.data.corner : null],
      ['labelsize', FLOW_LABEL_PX[edge.data?.labelSize] ? edge.data.labelSize : null],
      ['labelbg', edge.labelShowBg === false ? 'false' : null]
    ]));
  }
  return `<Flow>\n${lines.join('\n')}${lines.length ? '\n' : ''}</Flow>\n`;
};

const FlowLock = createContext(false);
// What the small bars beside a selected step, group or connector can do: { run(action, id), single }.
const FlowActions = createContext(null);

const QUICK_ACTIONS = {
  edit: ['FiEdit2', 'Write (double-click)'],
  settings: ['FiSettings', 'Settings (E)'],
  duplicate: ['FiCopy', 'Duplicate (Ctrl+D)'],
  delete: ['FiTrash2', 'Delete (Delete)'],
  collapse: ['FiMinimize2', 'Collapse or open this group'],
  lock: ['FiLock', 'Lock or unlock where this sits'],
  leave: ['FiLogOut', 'Take out of its group']
};

// A step's text and a connector's label are Markdown, drawn as formatted text with no editor around it.
// Raw HTML in the text is shown as text, never run.
const FLOW_MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks];
const FLOW_MARKDOWN_PARTS = {
  a: ({ href, children }) => <a className="nodrag" href={href} target="_blank" rel="noreferrer noopener">{children}</a>,
  img: () => null
};
const FlowMarkdown = ({ text, inline = false }) => (
  <div className={`flow-markdown${inline ? ' flow-markdown-inline' : ''}`}>
    <ReactMarkdown remarkPlugins={FLOW_MARKDOWN_PLUGINS} components={FLOW_MARKDOWN_PARTS}>{String(text ?? '')}</ReactMarkdown>
  </div>
);
// The writing tools: small and few, for notes inside a diagram.
const FlowWriterTools = () => (
  <>
    <UndoRedo />
    <Separator />
    <BoldItalicUnderlineToggles />
    <Separator />
    <BlockTypeSelect />
    <ListsToggle />
    <CreateLink />
  </>
);

// The small bar beside whatever is selected.
const QuickBar = ({ id, items }) => {
  const actions = useContext(FlowActions);
  return (
    <div className="flow-quickbar nodrag nopan" onDoubleClick={(event) => event.stopPropagation()}>
      <ButtonGroup selectable={false} size="xs">
        {items.map((item) => (
          <Button key={item} size="xs" variant="ghost" title={QUICK_ACTIONS[item][1]} onClick={(event) => { event.stopPropagation(); actions?.run(item, id); }}>
            <Icon name={QUICK_ACTIONS[item][0]} size="xs" />
          </Button>
        ))}
      </ButtonGroup>
    </div>
  );
};

// One compact form for a step, a group or a connector. Fields sit in two columns; a "wide" field spans both.
// Each field is { key, label, type: 'text' | 'number' | 'switch' | 'select', options?, wide? }.
const FLOW_OPTIONS = {
  size: [['xs', 'Extra small'], ['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['xl', 'Extra large'], ['2xl', 'Largest']],
  weight: [['light', 'Light'], ['normal', 'Normal'], ['medium', 'Medium'], ['semibold', 'Semibold'], ['bold', 'Bold'], ['extrabold', 'Extra bold']],
  align: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']],
  kind: [['editable', 'Step'], ['group', 'Group']],
  line: [['default', 'Curve'], ['simplebezier', 'Simple curve'], ['smoothstep', 'Rounded steps'], ['step', 'Square steps'], ['straight', 'Straight']],
  arrow: [['arrowclosed', 'Filled'], ['arrow', 'Open'], ['none', 'None']],
  side: [['top', 'Top'], ['right', 'Right'], ['bottom', 'Bottom'], ['left', 'Left']],
  labelSize: [['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']],
  dash: [['solid', 'Solid'], ['dashed', 'Dashed'], ['moving', 'Moving dashes']],
  hold: [['parent', 'Held inside the group'], ['free', 'Free to leave']]
};
const flowChoices = (name) => FLOW_OPTIONS[name].map(([value, label]) => ({ value, label }));

const FlowForm = ({ title, fields, values, onChange, onSave, onCancel }) => (
  <Container className="flow-form" layout="flex-column" gap="xs" padding="none" width="100%">
    <Typography size="xs" weight="semibold">{title}</Typography>
    <Container layout="grid" columns={2} gap="xs" padding="none" width="100%">
      {fields.map((field) => (
        <Container key={field.key} className={field.type === 'switch' ? 'flow-form-switch' : ''} padding="none" width="100%" minWidth="0" span={field.wide ? 'full' : null}>
          {field.type === 'select' && (
            <Select label={field.label} value={values[field.key] || field.empty || ''} onChange={(value) => onChange(field.key, value === field.empty ? '' : value)} size="xs" width="100%" options={field.options} />
          )}
          {field.type === 'switch' && (
            <Switch label={field.label} size="xs" checked={Boolean(values[field.key])} onChange={(event) => onChange(field.key, event.target.checked)} />
          )}
          {(field.type === 'text' || field.type === 'number') && (
            <Input
              label={field.label}
              type={field.type}
              value={values[field.key] ?? ''}
              onChange={(event) => onChange(field.key, field.type === 'number' ? parseInt(event.target.value, 10) || field.least || 0 : event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSave(); } }}
              size="xs"
              width="100%"
              {...(field.lines ? { multiline: true, rows: field.lines, placeholder: 'Shift+Enter for a new line' } : {})}
              {...(field.type === 'number' ? { min: field.least, max: field.most } : {})}
            />
          )}
        </Container>
      ))}
    </Container>
    <ButtonGroup spaced selectable={false} justify="end" size="xs">
      <Button size="xs" color="secondary" onClick={onCancel}>Cancel</Button>
      <Button size="xs" color="primary" onClick={onSave}>Save</Button>
    </ButtonGroup>
  </Container>
);

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
  { id: 'actual', kind: 'view', icon: 'FiSearch', label: 'Zoom to full size', keys: '0', hidden: true },
  { id: 'focus', kind: 'view', icon: 'FiTarget', label: 'Zoom to what is selected', keys: 'Z', needs: 'any', hidden: true },
  { id: 'snap', kind: 'edit', icon: 'FiCrosshair', label: 'Snap to the dots', keys: 'S' },
  { id: 'lock', kind: 'edit', icon: 'FiLock', label: 'Lock moving', keys: 'K' },
  { id: 'map', kind: 'view', icon: 'FiMap', label: 'Show or hide the map', keys: 'M' }
];
const FLOW_HISTORY = 100;
const FLOW_PATTERNS = ['dots', 'lines', 'cross'];
const FLOW_MEMBER_STEP = 56;
const FLOW_MARKS = ['flow-drop-target', 'flow-locked', 'flow-collapsed'];
const FLOW_PATTERN_ICONS = { dots: 'FiMoreHorizontal', lines: 'FiHash', cross: 'FiPlus' };
const FLOW_LABEL_PX = { sm: null, md: 12, lg: 15 };
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
const EditableNode = ({ data, id, selected, width }) => {
  const reactFlow = useReactFlow();
  const locked = useContext(FlowLock);
  const actions = useContext(FlowActions);
  const nodeInstance = reactFlow.getNode ? reactFlow.getNode(id) : null;
  const colorToken = useMemo(() => inferNodeColorToken({ data, style: nodeInstance?.style }), [data, nodeInstance?.style]);
  const shape = data.shape || DEFAULT_NODE_SHAPE;

  // Typography props with defaults
  const fontSize = data.fontSize || 'md';
  const fontWeight = data.fontWeight || 'semibold';
  const textAlign = data.textAlign || 'center';

  // A double-click on a step opens the writing editor for its text.
  const handleDoubleClick = () => { if (!locked) actions?.run('edit', id); };

  return (
    <div className={`flow-node ${width ? 'flow-node-sized' : ''}`} onDoubleClick={handleDoubleClick}>
      {!locked && <NodeResizer isVisible={Boolean(selected) && !data.locked} minWidth={80} minHeight={40} />}
      {!locked && actions && (
        <NodeToolbar isVisible={Boolean(selected) && actions.single} position={Position.Bottom}>
          <QuickBar id={id} items={['edit', 'settings']} />
        </NodeToolbar>
      )}
      {FLOW_SIDES.map((side) => <Handle key={side} type="source" position={side} id={side} />)}

      <div
        className={`flow-node-surface ${getNodeColorClass(colorToken)}`}
        data-shape={shape}
        data-color={colorToken}
        data-font-size={fontSize}
        data-font-weight={fontWeight}
        data-text-align={textAlign}
      >
        <div className="flow-node-geometry" aria-hidden="true" />
        <div className="flow-node-label"><FlowMarkdown text={data.label} /></div>
      </div>
    </div>
  );
};

// Simple GroupNode to render label since native group doesn't render it by default
// A group shows its label, and resize handles while it is selected
const GroupNode = ({ data, id, selected }) => {
  const locked = useContext(FlowLock);
  const reactFlow = useReactFlow();
  return (
    <>
      {!locked && <NodeResizer isVisible={Boolean(selected) && !data.collapsed && !data.locked} minWidth={160} minHeight={100} />}
      <Handle type="target" position={Position.Left} id="border" className="flow-group-anchor" isConnectable={false} />
      {!locked && data.collapsible && (
        <div className="flow-group-toggle nodrag nopan">
          <Button
            size="xs"
            variant="ghost"
            title={data.collapsed ? 'Open this group' : 'Collapse this group'}
            onClick={(event) => {
              event.stopPropagation();
              reactFlow.updateNodeData(id, { collapsed: data.collapsed ? undefined : true });
            }}
          >
            <Icon name={data.collapsed ? 'FiChevronRight' : 'FiChevronDown'} size="xs" />
          </Button>
        </div>
      )}
      {data.label}
    </>
  );
};

const nodeTypes = {
  editable: EditableNode,
  group: GroupNode
};

// A connector to a group runs straight from its step to the point on the group's border where it was attached.
const borderPoint = (group, side, along) => {
  const { x, y } = group.internals.positionAbsolute;
  const wide = group.measured?.width ?? group.width ?? 300;
  const tall = group.measured?.height ?? group.height ?? 200;
  if (side === 'right') return { x: x + wide, y: y + tall * along };
  if (side === 'top') return { x: x + wide * along, y };
  if (side === 'bottom') return { x: x + wide * along, y: y + tall };
  return { x, y: y + tall * along };
};

const FACING = { left: Position.Right, right: Position.Left, top: Position.Bottom, bottom: Position.Top };

// data.bend tightens or loosens a curve (0 to 1); data.corner rounds the corners of rounded steps (pixels).
const linePath = (line, ends, tune = {}) => (
  line === 'default' ? getBezierPath({ ...ends, curvature: tune.bend ?? 0.25 })
    : line === 'simplebezier' ? getSimpleBezierPath(ends)
    : line === 'smoothstep' ? getSmoothStepPath({ ...ends, borderRadius: tune.corner ?? 5 })
    : line === 'step' ? getSmoothStepPath({ ...ends, borderRadius: 0 })
    : getStraightPath(ends)
);

const drawEdge = (props, [path, labelX, labelY], items) => (
  <>
    <BaseEdge
      id={props.id}
      path={path}
      style={props.style}
      markerEnd={props.markerEnd}
      markerStart={props.markerStart}
      interactionWidth={props.interactionWidth}
    />
    {props.label && (
      <EdgeLabelRenderer>
        <div
          className={`flow-edge-label flow-edge-label-${FLOW_LABEL_PX[props.data?.labelSize] ? props.data.labelSize : 'sm'}${props.labelShowBg === false ? ' flow-edge-label-bare' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <FlowMarkdown text={props.label} inline />
        </div>
      </EdgeLabelRenderer>
    )}
    <EdgeBar id={props.id} x={labelX} y={labelY} selected={props.selected} items={items} />
  </>
);

const EdgeBar = ({ id, x, y, selected, items = ['edit', 'settings', 'delete'] }) => {
  const locked = useContext(FlowLock);
  const actions = useContext(FlowActions);
  if (locked || !actions) return null;
  return (
    <EdgeToolbar edgeId={id} x={x} y={y + 14} isVisible={Boolean(selected) && actions.single} alignY="top">
      <QuickBar id={id} items={items} />
    </EdgeToolbar>
  );
};

const lineEdge = (line) => function LineEdge(props) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data } = props;
  return drawEdge(props, linePath(line, { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }, data));
};

// A connector to a group reaches the border from inside the group, at the spot where it was attached.
const MemberEdge = (props) => {
  const { target, sourceX, sourceY, sourcePosition, data } = props;
  const group = useInternalNode(target);
  if (!group) return null;
  const side = data?.side || 'left';
  const end = borderPoint(group, side, data?.along ?? 0.5);
  return drawEdge(props, linePath(data?.line || 'step', { sourceX, sourceY, sourcePosition, targetX: end.x, targetY: end.y, targetPosition: FACING[side] }, data), ['delete']);
};

const edgeTypes = {
  default: lineEdge('default'),
  simplebezier: lineEdge('simplebezier'),
  smoothstep: lineEdge('smoothstep'),
  step: lineEdge('step'),
  straight: lineEdge('straight'),
  member: MemberEdge
};

const FlowCanvas = forwardRef(({
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
  children,
  onSelect,
  viewKey = null,
  canConnect,
  canDelete,
  proOptions = { hideAttribution: true },
  connectEdgeOptions = {
    type: 'default',
    animated: true,
    data: { color: NEW_EDGE_COLOR_TOKEN },
    style: buildEdgeStyle(undefined, NEW_EDGE_COLOR_TOKEN, 2),
    markerEnd: buildMarkerEnd('arrowclosed', NEW_EDGE_COLOR_TOKEN)
  },
  ...reactFlowProps
}, ref) => {
  const { currentTheme } = useTheme();
  const initialized = useNodesInitialized();
  const [fitSoon, setFitSoon] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);
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
  // A line from a step to its group can be selected and deleted, which takes the step out of the group.
  // It is not one of the flow's connectors, so its selection is kept here.
  const [memberPicked, setMemberPicked] = useState(() => new Set());
  const [paneMenu, setPaneMenu] = useState(null);
  const paneAnchorRef = useRef(null);
  // With a viewKey, where a person left the view and the background they chose are kept in their own browser.
  const viewStore = viewKey ? `flow-view:${viewKey}` : null;
  const savedView = useMemo(() => {
    if (!viewStore) return null;
    try {
      const kept = JSON.parse(localStorage.getItem(viewStore) || 'null');
      return kept && Number.isFinite(kept.zoom) ? kept : null;
    } catch {
      return null;
    }
  }, [viewStore]);
  const [pattern, setPattern] = useState(() => (FLOW_PATTERNS.includes(savedView?.pattern) ? savedView.pattern : backgroundVariant));
  const keepView = useCallback((viewport, chosen) => {
    if (!viewStore || !viewport) return;
    try {
      localStorage.setItem(viewStore, JSON.stringify({ x: viewport.x, y: viewport.y, zoom: viewport.zoom, pattern: chosen }));
    } catch { /* the view is simply not remembered */ }
  }, [viewStore]);
  const [arrangeOpen, setArrangeOpen] = useState(false);
  const arrangeAnchorRef = useRef(null);
  const [connecting, setConnecting] = useState(false);
  const [mapShown, setMapShown] = useState(Boolean(minimap));
  const hoverRef = useRef(false);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(sanitizedInitialNodes);
  // The writing editor for a step's text or a connector's label: { id, isNode, x, y, text }.
  const [writer, setWriter] = useState(null);
  const writerAnchorRef = useRef(null);
  const writerBoxRef = useRef(null);
  const writerRef = useRef(null);
  writerRef.current = writer;
  const saveWriter = useCallback(() => {
    const open = writerRef.current;
    if (!open) return;
    const text = String(open.text ?? '').replace(/\s+$/, '').slice(0, FLOW_LIMITS.text);
    if (open.isNode) reactFlowInstanceRef.current?.updateNodeData(open.id, { label: text });
    else setEdges((all) => all.map((edge) => (edge.id === open.id ? { ...edge, label: text } : edge)));
    setWriter(null);
  }, []);
  // A click anywhere else keeps what was written, as the old in-place editing did. The editor's own menus are not "elsewhere".
  useEffect(() => {
    if (!writer) return undefined;
    const away = (event) => {
      const target = event.target;
      if (!document.body.contains(target) || writerBoxRef.current?.contains(target)) return;
      if (target.closest?.('.mdxeditor-popup-container, [data-radix-popper-content-wrapper], [role="listbox"], [role="dialog"]')) return;
      saveWriter();
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [Boolean(writer), saveWriter]);
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

  const attachRef = useRef(null);
  const addBox = useCallback((kind, at = null) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const instance = reactFlowInstanceRef.current;
    const centre = at || (rect && instance
      ? instance.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
      : { x: 0, y: 0 });
    setNodes((current) => {
      const prefix = kind === 'group' ? 'group' : 'step';
      let number = current.length + 1;
      while (current.some((node) => node.id === `${prefix}-${number}`)) number++;
      const nudge = (current.length % 6) * 24;
      // With one group selected, a new step is made inside it.
      const chosen = current.filter((node) => node.selected);
      const home = !at && kind !== 'group' && chosen.length === 1 && chosen[0].type === 'group' ? chosen[0] : null;
      if (home) {
        const inside = current.filter((node) => node.parentId === home.id).length;
        const id = `${prefix}-${number}`;
        setTimeout(() => attachRef.current?.(id, home.id), 80);
        return [...current, sanitizeNode({ id, type: 'editable', parentId: home.id, extent: 'parent', expandParent: true, position: { x: 24 + (inside % 3) * 150, y: 60 + Math.floor(inside / 3) * 70 }, data: { label: 'New step' } })];
      }
      const box = kind === 'group'
        ? { id: `${prefix}-${number}`, type: 'group', position: { x: Math.round(centre.x - 150 + nudge), y: Math.round(centre.y - 100 + nudge) }, data: { label: 'Group', color: 'neutral' }, style: { width: 300, height: 200 } }
        : { id: `${prefix}-${number}`, type: 'editable', position: { x: Math.round(centre.x - 60 + nudge), y: Math.round(centre.y - 20 + nudge) }, data: { label: 'New step' } };
      return kind === 'group' ? [sanitizeNode(box), ...current] : [...current, sanitizeNode(box)];
    });
  }, [setNodes]);


  // A step joins a group when a connector from it is attached to the group's border, and leaves when that connector is deleted.
  const sizeOf = (node, wide, tall) => ({
    wide: node?.measured?.width ?? node?.width ?? node?.style?.width ?? wide,
    tall: node?.measured?.height ?? node?.height ?? node?.style?.height ?? tall
  });

  // A member is held inside its group, as the Parent option in the editor does, and is moved inside when it joins.
  const joinGroup = useCallback((stepId, groupId, side = null) => {
    const instance = reactFlowInstanceRef.current;
    const inner = instance?.getInternalNode?.(stepId);
    const at = inner?.internals?.positionAbsolute;
    const own = sizeOf(inner, 120, 48);
    setNodes((current) => {
      const group = current.find((node) => node.id === groupId && node.type === 'group');
      const step = current.find((node) => node.id === stepId);
      if (!group || !step || step.type === 'group') return current;
      const room = sizeOf(group, 300, 200);
      const from = step.parentId === groupId ? { x: step.position.x + group.position.x, y: step.position.y + group.position.y } : (at || step.position);
      const keep = (value, least, most) => Math.round(Math.min(Math.max(value, least), Math.max(least, most)));
      const position = { x: keep(from.x - group.position.x, 12, room.wide - own.wide - 12), y: keep(from.y - group.position.y, 40, room.tall - own.tall - 12) };
      // A step that came from outside settles a little in from the side its connector is attached to.
      const wasOutside = step.parentId !== groupId && (position.x !== Math.round(from.x - group.position.x) || position.y !== Math.round(from.y - group.position.y));
      if (wasOutside && side === 'left') position.x = 44;
      if (wasOutside && side === 'right') position.x = Math.max(12, Math.round(room.wide - own.wide - 44));
      if (wasOutside && side === 'top') position.y = 56;
      if (wasOutside && side === 'bottom') position.y = Math.max(40, Math.round(room.tall - own.tall - 44));
      return current.map((node) => (node.id !== stepId ? node : { ...node, parentId: groupId, extent: 'parent', expandParent: true, position }));
    });
  }, [setNodes]);

  // Leaving puts the step just outside the nearest side of the group, so it is plain that it left.
  const leaveGroup = useCallback((stepId, groupId) => {
    const inner = reactFlowInstanceRef.current?.getInternalNode?.(stepId);
    const at = inner?.internals?.positionAbsolute;
    const own = sizeOf(inner, 120, 48);
    setNodes((current) => {
      const group = current.find((node) => node.id === groupId);
      return current.map((node) => {
        if (node.id !== stepId || node.parentId !== groupId) return node;
        const { parentId: _parent, extent: _extent, expandParent: _expand, ...rest } = node;
        if (!at || !group) return rest;
        const room = sizeOf(group, 300, 200);
        const gaps = { left: at.x - group.position.x, right: group.position.x + room.wide - (at.x + own.wide), top: at.y - group.position.y, bottom: group.position.y + room.tall - (at.y + own.tall) };
        const side = Object.keys(gaps).sort((a, b) => gaps[a] - gaps[b])[0];
        const out = {
          left: { x: group.position.x - own.wide - 24, y: at.y },
          right: { x: group.position.x + room.wide + 24, y: at.y },
          top: { x: at.x, y: group.position.y - own.tall - 24 },
          bottom: { x: at.x, y: group.position.y + room.tall + 24 }
        }[side];
        return { ...rest, position: { x: Math.round(out.x), y: Math.round(out.y) } };
      });
    });
  }, [setNodes]);

  const groupIdsNow = () => new Set((reactFlowInstanceRef.current?.getNodes() || []).filter((node) => node.type === 'group').map((node) => node.id));

  const onConnect = useCallback(
    (params) => {
      const groups = groupIdsNow();
      if (groups.has(params.source) || groups.has(params.target)) return;
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

      setEdges((eds) => (eds.some((edge) => edge.source === params.source && edge.target === params.target) ? eds : addEdge(themedEdge, eds)));
      onConnectProp?.(params);
    },
    [setEdges, connectEdgeOptions, onConnectProp]
  );

  // Attaches a step to a point on a group's border: the step joins the group and the connector is kept.
  // A step belongs to one group at a time, so a connector it had to any group is replaced.
  const connectToGroup = useCallback(({ source, target, side }) => {
    const groups = groupIdsNow();
    if (!groups.has(target) || groups.has(source)) return;
    joinGroup(source, target, side);
  }, [joinGroup]);

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
      width: node.type === 'group' ? Math.round(node.width ?? node.style?.width ?? node.measured?.width ?? 300) : Math.round(node.width || 0),
      height: node.type === 'group' ? Math.round(node.height ?? node.style?.height ?? node.measured?.height ?? 200) : Math.round(node.height || 0),
      locked: Boolean(node.data?.locked),
      collapsible: Boolean(node.data?.collapsible),
      parentId: node.parentId ?? '',
      extent: node.extent ?? ''
    });
    setEdgeEditor(null);
    onNodeContextMenu?.(e, node);
  }, [getNodeVisualState, onNodeContextMenu, readOnly]);
  
  const onEdgeContextMenuHandler = useCallback((e, edge) => {
    e.preventDefault();
    if (readOnly || edge.type === 'member') return;
    const rect = containerRef.current?.getBoundingClientRect();
    const color = inferEdgeColorToken(edge);
    setEdgeEditor({
      edgeId: edge.id,
      x: rect ? e.clientX - rect.left : e.clientX,
      y: rect ? e.clientY - rect.top : e.clientY,
      label: String(edge.label ?? ''),
      type: edge.type === 'member' ? edge.data?.line || 'step' : edge.type || 'smoothstep',
      from: sideOf(edge.sourceHandle) || 'right',
      to: edge.type === 'member' ? edge.data?.side || 'left' : sideOf(edge.targetHandle) || 'left',
      markerStart: (typeof edge.markerStart === 'string' ? edge.markerStart : edge.markerStart?.type) || '',
      dash: edge.animated ? 'moving' : edge.style?.strokeDasharray ? 'dashed' : 'solid',
      color: edge.type === 'member' && edge.data?.follow ? 'group' : color,
      strokeWidth: edge.style?.strokeWidth || 2,
      markerEnd: (typeof edge.markerEnd === 'string' ? edge.markerEnd : edge.markerEnd?.type) || '',
      member: edge.type === 'member',
      bend: Math.round((edge.data?.bend ?? 0.25) * 100),
      corner: edge.data?.corner ?? 5,
      labelSize: edge.data?.labelSize || 'sm',
      labelBg: edge.labelShowBg !== false
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
    // Moving to another group, or to none, goes through the same joining and leaving as everywhere else.
    const was = nodes.find((node) => node.id === nodeEditor.nodeId)?.parentId || undefined;
    if (was !== parentId) {
      if (was) leaveGroup(nodeEditor.nodeId, was);
      if (parentId) joinGroup(nodeEditor.nodeId, parentId);
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeEditor.nodeId) return n;
        const sanitizedStyle = stripNodeColorStyle(n.style);
        const { style: _omit, width: _wide, height: _tall, ...rest } = n;
        const stepSize = (value, least) => (value > 0 ? Math.min(Math.max(value, least), 2000) : null);
        
        // Set default style for group nodes
        const groupStyle = nodeType === 'group' ? {
          ...sanitizedStyle,
          width: Math.min(Math.max(nodeEditor.width || sanitizedStyle?.width || 300, 160), 4000),
          height: Math.min(Math.max(nodeEditor.height || sanitizedStyle?.height || 200, 100), 4000)
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
            textAlign,
            locked: nodeEditor.locked ? true : undefined,
            collapsible: nodeType === 'group' && nodeEditor.collapsible ? true : undefined,
            collapsed: nodeType === 'group' && nodeEditor.collapsible && n.data?.collapsed ? true : undefined
          },
          ...(groupStyle ? { style: groupStyle } : {}),
          ...(isGroup ? { width: groupStyle.width, height: groupStyle.height } : {}),
          ...(!isGroup && stepSize(nodeEditor.width, 80) ? { width: stepSize(nodeEditor.width, 80) } : {}),
          ...(!isGroup && stepSize(nodeEditor.height, 40) ? { height: stepSize(nodeEditor.height, 40) } : {}),
          ...(n.parentId && parentId === n.parentId && !extent ? { extent: undefined } : {}),
          ...(n.parentId && parentId === n.parentId && extent ? { extent } : {})

        };
      })
    );
    setNodeEditor(null);
  }, [nodeEditor, setNodes, nodes, joinGroup, leaveGroup]);
  
  const saveEdge = useCallback(() => {
    if (!edgeEditor) return;
    const colorToken = resolveColorToken(edgeEditor.color, DEFAULT_EDGE_COLOR_TOKEN);
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeEditor.edgeId
          ? {
              ...e,
              label: edgeEditor.label || undefined,
              type: e.type === 'member' ? 'member' : edgeEditor.type,
              sourceHandle: `${edgeEditor.from}`,
              targetHandle: e.type === 'member' ? 'border' : `${edgeEditor.to}`,
              animated: edgeEditor.dash === 'moving',
              data: {
                ...e.data,
                color: colorToken,
                bend: Math.min(Math.max(edgeEditor.bend ?? 25, 0), 100) / 100,
                corner: Math.min(Math.max(edgeEditor.corner ?? 5, 0), 40),
                labelSize: edgeEditor.labelSize,
                ...(e.type === 'member' ? { side: edgeEditor.to, line: edgeEditor.type, follow: edgeEditor.color === 'group' } : {})
              },
              labelStyle: FLOW_LABEL_PX[edgeEditor.labelSize] ? { fontSize: FLOW_LABEL_PX[edgeEditor.labelSize] } : undefined,
              labelShowBg: edgeEditor.labelBg ? undefined : false,
              className: withEdgeColorClass(e.className, colorToken),
              markerStart: buildMarkerEnd(edgeEditor.markerStart, colorToken),
              style: buildEdgeStyle({ ...e.style, strokeDasharray: edgeEditor.dash === 'dashed' ? FLOW_DASHES : undefined }, colorToken, edgeEditor.strokeWidth ?? e.style?.strokeWidth ?? 2),
              markerEnd: buildMarkerEnd(edgeEditor.markerEnd, colorToken)
            }
          : e
      )
    );
    setEdgeEditor(null);
  }, [edgeEditor, setEdges]);
  
  const shownNodes = useMemo(() => {
    const shut = new Set(nodes.filter((node) => node.type === 'group' && node.data?.collapsed).map((node) => node.id));
    return nodes.map((node) => {
      const isShut = shut.has(node.id);
      const fixed = Boolean(node.data?.locked);
      // The library hands these drawn copies back when it updates a box, so each marker is worked out afresh
      // every time and never left over from the last drawing.
      const kept = (node.className || '').split(' ').filter((name) => name && !FLOW_MARKS.includes(name));
      const classes = [...kept, node.id === dropTarget && 'flow-drop-target', fixed && 'flow-locked', isShut && 'flow-collapsed'].filter(Boolean).join(' ');
      return {
        ...node,
        ariaLabel: `${node.type === 'group' ? 'Group' : 'Step'}: ${node.data?.label || node.id}`,
        hidden: shut.has(node.parentId),
        className: classes || undefined,
        draggable: fixed ? false : undefined
      };
    });
  }, [nodes, dropTarget]);

  const shownEdges = useMemo(() => {
    const names = new Map(shownNodes.map((node) => [node.id, node.data?.label || node.id]));
    const gone = new Set(shownNodes.filter((node) => node.hidden).map((node) => node.id));
    const tint = new Map(shownNodes.filter((node) => node.type === 'group').map((node) => [node.id, resolveColorToken(node.data?.color, 'neutral')]));
    const drawn = edges.map((edge) => ({
      ...edge,
      ariaLabel: `Connector from ${names.get(edge.source)} to ${names.get(edge.target)}`,
      hidden: gone.has(edge.source) || gone.has(edge.target)
    }));
    // Every step in a group gets a line to the nearest point of the group's border. These lines are the
    // component's own: one fixed style in the group's colour, not selectable, not editable, not in the file.
    // They are listed first and given no lift of their own, so they sit above the group's background but beneath
    // every step and every connector.
    const lines = [];
    const boxes = new Map(shownNodes.map((node) => [node.id, node]));
    for (const step of shownNodes) {
      const group = step.parentId ? boxes.get(step.parentId) : null;
      if (!group || step.hidden || group.data?.collapsed) continue;
      const own = sizeOf(step, 120, 48);
      const room = sizeOf(group, 300, 200);
      const middle = { x: step.position.x + own.wide / 2, y: step.position.y + own.tall / 2 };
      const gaps = { left: middle.x, right: room.wide - middle.x, top: middle.y, bottom: room.tall - middle.y };
      const side = Object.keys(gaps).sort((a, b) => gaps[a] - gaps[b])[0];
      // The line meets the border a fixed distance to one side of the step, towards the middle of that side,
      // so it always has a clear step in it and never runs straight.
      const upright = side === 'left' || side === 'right';
      const span = upright ? room.tall : room.wide;
      const level = upright ? middle.y : middle.x;
      const meet = Math.min(Math.max(level + (level < span / 2 ? FLOW_MEMBER_STEP : -FLOW_MEMBER_STEP), 16), Math.max(16, span - 16));
      const along = meet / span;
      lines.push(sanitizeEdge({
        id: `member-${step.id}`,
        source: step.id,
        target: group.id,
        sourceHandle: side,
        targetHandle: 'border',
        type: 'member',
        zIndex: 0,
        focusable: false,
        selected: memberPicked.has(`member-${step.id}`),
        reconnectable: false,
        className: 'flow-member-edge',
        ariaLabel: `${names.get(step.id)} is in ${names.get(group.id)}`,
        data: { color: tint.get(group.id), side, along, line: 'smoothstep', corner: 14 },
        style: { strokeWidth: 2 },
        markerEnd: { type: 'arrowclosed' }
      }));
    }
    return [...lines, ...drawn];
  }, [edges, shownNodes, memberPicked]);

  // A connector cannot join a box to itself, repeat one that is already there, or break a rule the page gives.
  const validConnection = useCallback((link) => (
    link.source !== link.target
    && !edges.some((edge) => edge.source === link.source && edge.target === link.target && edge.sourceHandle === link.sourceHandle && edge.targetHandle === link.targetHandle)
    && (canConnect ? canConnect(link) !== false : true)
  ), [edges, canConnect]);

  const onEdgesChangeHandler = useCallback((changes) => {
    const own = [];
    for (const change of changes) {
      if (!String(change.id).startsWith('member-')) {
        own.push(change);
        continue;
      }
      if (change.type === 'select') {
        setMemberPicked((now) => {
          const next = new Set(now);
          if (change.selected) next.add(change.id);
          else next.delete(change.id);
          return next;
        });
      }
      if (change.type === 'remove' && !readOnly) {
        const stepId = String(change.id).slice('member-'.length);
        const groupId = reactFlowInstanceRef.current?.getNode(stepId)?.parentId;
        if (groupId) leaveGroup(stepId, groupId);
        setMemberPicked((now) => {
          const next = new Set(now);
          next.delete(change.id);
          return next;
        });
      }
    }
    if (own.length) onEdgesChange(own);
  }, [onEdgesChange, leaveGroup, readOnly]);

  const canEdit = !readOnly && toolbar !== 'view';
  const chosenNodes = nodes.filter((node) => node.selected);
  const chosenEdges = edges.filter((edge) => edge.selected);
  const chosenSteps = chosenNodes.filter((node) => node.type !== 'group');
  const actionReady = {
    one: chosenNodes.length + chosenEdges.length === 1 && memberPicked.size === 0,
    steps: chosenSteps.length > 0,
    any: chosenNodes.length + chosenEdges.length + memberPicked.size > 0,
    undo: historySize.undo > 0,
    redo: historySize.redo > 0
  };

  // After boxes are moved, every connector is put on the sides that face each other, so none doubles back.
  // place holds the new positions of the boxes that moved.
  const reroute = (place, sizes = new Map()) => {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const spot = (node) => {
      const own = place.get(node.id) || node.position;
      const parent = node.parentId ? byId.get(node.parentId) : null;
      const base = parent ? place.get(parent.id) || parent.position : { x: 0, y: 0 };
      return { x: base.x + own.x, y: base.y + own.y, ...(sizes.get(node.id) || sizeOf(node, node.type === 'group' ? 300 : 120, node.type === 'group' ? 200 : 48)) };
    };
    setEdges((current) => current.map((edge) => {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      if (!from || !to) return edge;
      const a = spot(from);
      const b = spot(to);
      const middle = { x: a.x + a.wide / 2, y: a.y + a.tall / 2 };
      if (edge.type === 'member') {
        const { side, along } = onBorder({ ...to, position: { x: b.x, y: b.y }, measured: { width: b.wide, height: b.tall } }, middle);
        return { ...edge, sourceHandle: `${side}`, data: { ...edge.data, side, along } };
      }
      const across = b.x + b.wide / 2 - middle.x;
      const down = b.y + b.tall / 2 - middle.y;
      const [out, into] = Math.abs(across) >= Math.abs(down)
        ? (across >= 0 ? ['right', 'left'] : ['left', 'right'])
        : (down >= 0 ? ['bottom', 'top'] : ['top', 'bottom']);
      return { ...edge, sourceHandle: `${out}`, targetHandle: `${into}` };
    }));
  };

  // Arranges the steps inside each group first, sizing the group to fit them, then arranges the groups
  // and the steps outside them together, and last puts every connector on facing sides.
  const arrange = (kind) => {
    const place = new Map();
    const sizes = new Map();
    const measure = (node) => sizes.get(node.id) || sizeOf(node, node.type === 'group' ? 300 : 120, node.type === 'group' ? 200 : 48);
    const groupOf = new Map(nodes.filter((node) => node.parentId).map((node) => [node.id, node.parentId]));

    for (const group of nodes.filter((node) => node.type === 'group')) {
      const members = nodes.filter((node) => node.parentId === group.id && node.type !== 'group');
      if (members.length === 0) continue;
      const ids = new Set(members.map((node) => node.id));
      const inner = layoutItems(
        members.map((node) => ({ id: node.id, ...measure(node) })),
        edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
        kind
      );
      let wide = 160;
      let tall = 100;
      for (const node of members) {
        const at = { x: inner.get(node.id).x + 32, y: inner.get(node.id).y + 56 };
        place.set(node.id, at);
        wide = Math.max(wide, at.x + measure(node).wide + 32);
        tall = Math.max(tall, at.y + measure(node).tall + 32);
      }
      sizes.set(group.id, { wide: Math.round(wide), tall: Math.round(tall) });
    }

    const outer = nodes.filter((node) => !node.parentId);
    const outerIds = new Set(outer.map((node) => node.id));
    const between = edges
      .filter((edge) => edge.type !== 'member')
      .map((edge) => ({ source: groupOf.get(edge.source) || edge.source, target: groupOf.get(edge.target) || edge.target }))
      .filter((wire) => wire.source !== wire.target && outerIds.has(wire.source) && outerIds.has(wire.target));
    for (const [id, at] of layoutItems(outer.map((node) => ({ id: node.id, ...measure(node) })), between, kind)) place.set(id, at);
    if (place.size === 0) return;

    setNodes((current) => current.map((node) => {
      const at = place.get(node.id);
      const size = sizes.get(node.id);
      if (!at && !size) return node;
      return {
        ...node,
        ...(at ? { position: { x: Math.round(at.x), y: Math.round(at.y) } } : {}),
        ...(size ? { width: size.wide, height: size.tall, style: { ...node.style, width: size.wide, height: size.tall } } : {})
      };
    }));
    reroute(place, sizes);
    setFitSoon(true);
  };

  // The fit is left to run once the moved boxes have been drawn; it is not tied to this effect's own clean-up,
  // which would cancel it as soon as the flag below is cleared.
  useEffect(() => {
    if (!fitSoon || !initialized) return;
    setFitSoon(false);
    requestAnimationFrame(() => requestAnimationFrame(() => reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 200 })));
  }, [fitSoon, initialized]);

  const arrangeRef = useRef(arrange);
  arrangeRef.current = arrange;

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
    reroute(place);
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
    if (id === 'actual') instance?.zoomTo(1, { duration: 150 });
    if (id === 'focus') {
      const ids = chosenNodes.length ? chosenNodes.map((node) => node.id) : [...new Set(chosenEdges.flatMap((edge) => [edge.source, edge.target]))];
      instance?.fitView({ nodes: ids.map((nodeId) => ({ id: nodeId })), padding: 0.4, duration: 200, maxZoom: 1.5 });
    }
    if (id === 'lock') setLocked((now) => !now);
    if (id === 'map') setMapShown((now) => !now);
    if (id === 'undo') stepBack('past', 'future');
    if (id === 'redo') stepBack('future', 'past');
    if (id === 'delete') instance?.deleteElements({ nodes: chosenNodes, edges: [...chosenEdges, ...[...memberPicked].map((edgeId) => ({ id: edgeId }))] });
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

  // Where a form or the writing editor opens: below the middle of the step or connector it is for.
  const anchorBelow = (target) => {
    const box = containerRef.current?.getBoundingClientRect();
    const drawn = containerRef.current?.querySelector(`[data-id="${CSS.escape(target.id)}"]`)?.getBoundingClientRect();
    return { clientX: drawn ? drawn.left + drawn.width / 2 : (box?.left ?? 0) + (box?.width ?? 0) / 2, clientY: drawn ? drawn.bottom : (box?.top ?? 0) + (box?.height ?? 0) / 2, preventDefault: () => {} };
  };
  const openWriter = (target, isNode) => {
    const at = anchorBelow(target);
    const box = containerRef.current?.getBoundingClientRect();
    setNodeEditor(null);
    setEdgeEditor(null);
    setWriter({ id: target.id, isNode, x: box ? at.clientX - box.left : at.clientX, y: box ? at.clientY - box.top : at.clientY, text: String((isNode ? target.data?.label : target.label) ?? '') });
  };

  const quick = (action, id) => {
    const instance = reactFlowInstanceRef.current;
    const node = instance?.getNode(id);
    const edge = node ? null : instance?.getEdge(id);
    if (!node && !edge) return;
    if (action === 'delete') instance.deleteElements({ nodes: node ? [node] : [], edges: edge ? [edge] : [] });
    if (action === 'duplicate') runActionRef.current(action);
    if (action === 'edit' && edge?.type !== 'member') openWriter(node || edge, Boolean(node));
    if (action === 'settings' && node) onContextMenu(anchorBelow(node), node);
    if (action === 'settings' && edge) onEdgeContextMenuHandler(anchorBelow(edge), edge);
    if (action === 'lock' && node) instance.updateNodeData(id, { locked: !node.data?.locked });
    if (action === 'leave' && node?.parentId) leaveGroup(id, node.parentId);
    if (action === 'collapse' && node) instance.updateNodeData(id, { collapsed: !node.data?.collapsed });
  };
  const quickRef = useRef(quick);
  quickRef.current = quick;
  const single = chosenNodes.length + chosenEdges.length + memberPicked.size === 1;
  const actionsValue = useMemo(() => ({ run: (action, id) => quickRef.current(action, id), single }), [single]);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const chosenKey = [...chosenNodes, ...chosenEdges].map((item) => item.id).join(' ');
  useEffect(() => {
    onSelectRef.current?.({ nodes: chosenNodes, edges: chosenEdges });
  }, [chosenKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    run: (id) => runActionRef.current(id),
    arrange: (kind) => arrangeRef.current(kind),
    text: () => writtenTextRef.current,
    fit: () => reactFlowInstanceRef.current?.fitView({ padding: 0.2, duration: 200 }),
    select: (ids = []) => {
      const wanted = new Set(ids);
      setNodes((current) => current.map((node) => ({ ...node, selected: wanted.has(node.id) })));
      setEdges((current) => current.map((edge) => ({ ...edge, selected: wanted.has(edge.id) })));
    },
    update: (id, data) => reactFlowInstanceRef.current?.updateNodeData(id, data),
    instance: () => reactFlowInstanceRef.current
  }), [setNodes, setEdges]);

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
        : ({ n: 'step', g: 'group', e: 'edit', l: event.shiftKey ? 'tidyDown' : 'tidy', s: 'snap', f: 'fit', k: 'lock', m: 'map', z: 'focus', 0: 'actual', '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut' })[key];
      if (!id) return;
      event.preventDefault();
      runActionRef.current(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolbar]);

  // Where a point sits on a group's border: the nearest side, and how far along that side.
  const onBorder = (group, point) => {
    const room = sizeOf(group, 300, 200);
    const within = { x: point.x - group.position.x, y: point.y - group.position.y };
    const gaps = { left: Math.abs(within.x), right: Math.abs(room.wide - within.x), top: Math.abs(within.y), bottom: Math.abs(room.tall - within.y) };
    const side = Object.keys(gaps).sort((a, b) => gaps[a] - gaps[b])[0];
    const along = side === 'left' || side === 'right' ? within.y / room.tall : within.x / room.wide;
    return { side, along: Math.min(Math.max(along, 0.04), 0.96) };
  };

  // Puts a step in a group without a connector having been drawn: one is added to the border nearest the step.
  const attach = useCallback((stepId, groupId) => {
    const instance = reactFlowInstanceRef.current;
    const step = instance?.getInternalNode?.(stepId);
    const group = instance?.getNode?.(groupId);
    if (!step || !group) return;
    const at = step.internals?.positionAbsolute || step.position;
    const own = sizeOf(step, 120, 48);
    const { side, along } = onBorder(group, { x: at.x + own.wide / 2, y: at.y + own.tall / 2 });
    connectToGroup({ source: stepId, sourceHandle: `${side}`, target: groupId, side, along });
  }, [connectToGroup]);
  attachRef.current = attach;

  // A connector let go on a group attaches to the nearest point of its border; a group has no fixed points.
  const onConnectEndHandler = useCallback((event, state) => {
    setConnecting(false);
    const instance = reactFlowInstanceRef.current;
    if (readOnly || !instance || !state || state.isValid || !state.fromNode || state.fromNode.type === 'group' || state.fromHandle?.type !== 'source') return;
    const pointer = 'changedTouches' in event ? event.changedTouches[0] : event;
    const at = instance.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY });
    const reach = 24;
    const group = instance.getNodes().find((node) => {
      if (node.type !== 'group') return false;
      const room = sizeOf(node, 300, 200);
      return at.x >= node.position.x - reach && at.x <= node.position.x + room.wide + reach && at.y >= node.position.y - reach && at.y <= node.position.y + room.tall + reach;
    });
    if (!group) return;
    connectToGroup({ source: state.fromNode.id, sourceHandle: state.fromHandle.id, target: group.id, ...onBorder(group, at) });
  }, [readOnly, connectToGroup]);

  // Dropping a step wholly inside a group puts it in that group. A member cannot be dragged out; deleting its
  // connector takes it out. While a step is dragged, the group it would join is lit.
  const groupUnder = useCallback((item) => {
    if (!item || item.type === 'group' || item.parentId) return null;
    return reactFlowInstanceRef.current?.getIntersectingNodes(item, false).find((node) => node.type === 'group') || null;
  }, []);

  const onNodeDragHandler = useCallback((_event, node) => {
    const home = groupUnder(node)?.id || null;
    setDropTarget((now) => (now === home ? now : home));
  }, [groupUnder]);

  const onNodeDragStopHandler = useCallback((_event, _node, dragged = []) => {
    setDropTarget(null);
    for (const item of dragged) {
      const home = groupUnder(item);
      if (home) attach(item.id, home.id);
    }
  }, [attach, groupUnder]);

  const onPaneClickHandler = useCallback((e) => {
    setNodeEditor(null);
    setEdgeEditor(null);
    setArrangeOpen(false);
    setPaneMenu(null);
    if (enableNodeCreation && !readOnly) {
      const keyMatch = !nodeCreationKey || nodeCreationKey === 'none' ||
        (nodeCreationKey === 'ctrl' && (e.ctrlKey || e.metaKey)) ||
        (nodeCreationKey === 'alt' && e.altKey);
      
      if (keyMatch) {
        const instance = reactFlowInstanceRef.current;
        let position = null;

        if (instance) position = instance.screenToFlowPosition({ x: e.clientX, y: e.clientY });

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

  const onPaneMenu = useCallback((event) => {
    event.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    setNodeEditor(null);
    setEdgeEditor(null);
    setPaneMenu({
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
      at: reactFlowInstanceRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) || null
    });
  }, []);

  const handleInit = useCallback((instance) => {
    reactFlowInstanceRef.current = instance;
    if (savedView) instance.setViewport({ x: savedView.x, y: savedView.y, zoom: savedView.zoom });
    onInit?.(instance);
  }, [onInit, savedView]);

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
        ref={paneAnchorRef}
        style={{
          position: 'absolute',
          left: `${paneMenu?.x ?? 0}px`,
          top: `${paneMenu?.y ?? 0}px`,
          width: 0,
          height: 0,
          pointerEvents: 'none'
        }}
      />

      {/* Canvas menu: right-click on empty canvas */}
      <Genie visible={Boolean(paneMenu)} triggerRef={paneAnchorRef} onClose={() => setPaneMenu(null)} variant="menu" animation="scale" layout="flex-column" padding="xs">
        <Container layout="flex-column" gap="xs" padding="none">
          <ButtonGroup selectable={false} size="xs">
            <Button size="xs" variant="ghost" title="Add a step here" onClick={() => { addBox('node', paneMenu?.at); setPaneMenu(null); }}>
              <Icon name="FiPlusSquare" size="xs" />
            </Button>
            <Button size="xs" variant="ghost" title="Add a group here" onClick={() => { addBox('group', paneMenu?.at); setPaneMenu(null); }}>
              <Icon name="FiGrid" size="xs" />
            </Button>
            <Button size="xs" variant="ghost" title="Select everything (Ctrl+A)" onClick={() => { runAction('selectAll'); setPaneMenu(null); }}>
              <Icon name="FiCheckSquare" size="xs" />
            </Button>
            <Button size="xs" variant="ghost" title="Fit everything on screen (F)" onClick={() => { runAction('fit'); setPaneMenu(null); }}>
              <Icon name="FiMaximize" size="xs" />
            </Button>
            <Button size="xs" variant="ghost" title="Zoom to full size (0)" onClick={() => { runAction('actual'); setPaneMenu(null); }}>
              <Icon name="FiSearch" size="xs" />
            </Button>
            <Button size="xs" variant="ghost" title="Zoom to what is selected (Z)" disabled={!actionReady.any} onClick={() => { runAction('focus'); setPaneMenu(null); }}>
              <Icon name="FiTarget" size="xs" />
            </Button>
          </ButtonGroup>
          <ButtonGroup selectable={false} size="xs">
            {FLOW_PATTERNS.map((choice) => (
              <Button key={choice} size="xs" variant="ghost" selected={pattern === choice} title={`Background: ${choice}`} onClick={() => { setPattern(choice); keepView(reactFlowInstanceRef.current?.getViewport(), choice); }}>
                <Icon name={FLOW_PATTERN_ICONS[choice]} size="xs" />
              </Button>
            ))}
          </ButtonGroup>
        </Container>
      </Genie>

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

      {/* Step and group editor */}
      <Genie visible={Boolean(nodeEditor)} triggerRef={anchorRef} onClose={() => setNodeEditor(null)} variant="menu" animation="scale" layout="flex-column" padding="sm" width="300px">
        {nodeEditor && (
          <FlowForm
            title={nodeEditor.nodeType === 'group' ? 'Group' : 'Step'}
            values={nodeEditor}
            onChange={(key, value) => setNodeEditor((now) => (now ? { ...now, [key]: value, ...(key === 'parentId' ? { extent: value ? 'parent' : '' } : {}) } : now))}
            onSave={saveNode}
            onCancel={() => setNodeEditor(null)}
            fields={nodeEditor.nodeType === 'group' ? [
              { key: 'label', label: 'Label', type: 'text', wide: true },
              { key: 'color', label: 'Colour', type: 'select', options: COLOR_OPTIONS },
              { key: 'nodeType', label: 'Kind', type: 'select', options: flowChoices('kind') },
              { key: 'width', label: 'Width', type: 'number', least: 160, most: 4000 },
              { key: 'height', label: 'Height', type: 'number', least: 100, most: 4000 },
              { key: 'locked', label: 'Locked', type: 'switch' },
              { key: 'collapsible', label: 'Collapsible', type: 'switch' }
            ] : [
              { key: 'label', label: 'Label', type: 'text', wide: true, lines: 2 },
              { key: 'color', label: 'Colour', type: 'select', options: COLOR_OPTIONS },
              { key: 'shape', label: 'Shape', type: 'select', options: NODE_SHAPE_OPTIONS },
              { key: 'fontSize', label: 'Text size', type: 'select', options: flowChoices('size') },
              { key: 'fontWeight', label: 'Text weight', type: 'select', options: flowChoices('weight') },
              { key: 'textAlign', label: 'Text side', type: 'select', options: flowChoices('align') },
              { key: 'nodeType', label: 'Kind', type: 'select', options: flowChoices('kind') },
              {
                key: 'parentId',
                label: 'In group',
                type: 'select',
                empty: 'none',
                wide: !nodeEditor.parentId,
                options: [{ value: 'none', label: 'None' }, ...nodes.filter((node) => node.id !== nodeEditor.nodeId && node.type === 'group').map((node) => ({ value: node.id, label: node.data?.label || node.id }))]
              },
              ...(nodeEditor.parentId ? [{ key: 'extent', label: 'Movement', type: 'select', empty: 'free', options: flowChoices('hold') }] : []),
              { key: 'width', label: 'Width (0 fits the text)', type: 'number', most: 2000 },
              { key: 'height', label: 'Height (0 fits the text)', type: 'number', most: 2000 },
              { key: 'locked', label: 'Locked', type: 'switch' }
            ]}
          />
        )}
      </Genie>

      {/* Arrange menu */}
      <Genie visible={arrangeOpen} triggerRef={arrangeAnchorRef} onClose={() => setArrangeOpen(false)} variant="menu" animation="scale" layout="flex-column" padding="xs">
        <Container layout="flex-column" gap="xs" padding="none">
          <ButtonGroup selectable={false} size="xs">
            {FLOW_LAYOUTS.map((layout) => (
              <Button key={layout.id} size="xs" variant="ghost" title={layout.label} onClick={() => { arrange(layout.id); setArrangeOpen(false); }}>
                <Icon name={layout.icon} size="xs" />
              </Button>
            ))}
          </ButtonGroup>
          {chosenSteps.length < 2 ? (
            <Typography size="xxs" color="muted" align="center">Ctrl+click steps to line them up</Typography>
          ) : (
            <ButtonGroup selectable={false} size="xs">
              {FLOW_ALIGNMENTS.filter((alignment) => chosenSteps.length >= alignment.least).map((alignment) => (
                <Button key={alignment.id} size="xs" variant="ghost" title={alignment.label} onClick={() => { alignChosen(alignment.id); setArrangeOpen(false); }}>
                  <Icon name={alignment.icon} size="xs" />
                </Button>
              ))}
            </ButtonGroup>
          )}
        </Container>
      </Genie>

      {/* Writing editor */}
      <div
        ref={writerAnchorRef}
        style={{ position: 'absolute', left: `${writer?.x ?? 0}px`, top: `${writer?.y ?? 0}px`, width: 0, height: 0, pointerEvents: 'none' }}
      />
      <Genie visible={Boolean(writer)} triggerRef={writerAnchorRef} onClose={saveWriter} closeOnClickOutside={false} variant="menu" animation="scale" layout="flex-column" padding="xs" width="380px">
        {writer && (
          <Container ref={writerBoxRef} layout="flex-column" gap="xs" padding="none" width="100%">
            <Editor
              key={writer.id}
              className="flow-writer"
              mode="markdown"
              content={writer.text}
              autoFocus
              placeholder="Write here. Bold, headings, lists and links all work."
              customToolbar={FlowWriterTools}
              minHeight="96px"
              maxHeight="260px"
              onChange={(text) => setWriter((now) => (now ? { ...now, text } : now))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  saveWriter();
                }
                if (event.key === 'Escape') setWriter(null);
              }}
            />
            <Container layout="flex" align="center" justify="between" gap="xs" padding="none" width="100%" wrap={false}>
              <Typography size="xxs" color="muted">Ctrl+Enter saves · Esc cancels</Typography>
              <ButtonGroup size="xs" spaced selectable={false} justify="end" wrap={false}>
                <Button size="xs" color="secondary" onClick={() => setWriter(null)}>Cancel</Button>
                <Button size="xs" color="primary" onClick={saveWriter}>Save</Button>
              </ButtonGroup>
            </Container>
          </Container>
        )}
      </Genie>

      {/* Connector editor */}
      <Genie visible={Boolean(edgeEditor)} triggerRef={edgeAnchorRef} onClose={() => setEdgeEditor(null)} variant="menu" animation="scale" layout="flex-column" padding="sm" width="300px">
        {edgeEditor && (
          <FlowForm
            title="Connector"
            values={edgeEditor}
            onChange={(key, value) => setEdgeEditor((now) => (now ? { ...now, [key]: value } : now))}
            onSave={saveEdge}
            onCancel={() => setEdgeEditor(null)}
            fields={[
              { key: 'label', label: 'Label', type: 'text', wide: true, lines: 2 },
              { key: 'color', label: 'Colour', type: 'select', options: edgeEditor.member ? [{ value: 'group', label: 'Same as the group' }, ...COLOR_OPTIONS] : COLOR_OPTIONS },
              { key: 'strokeWidth', label: 'Width', type: 'number', least: 1, most: 10 },
              { key: 'type', label: 'Curve shape', type: 'select', options: flowChoices('line') },
              { key: 'markerStart', label: 'Arrow at start', type: 'select', empty: 'none', options: flowChoices('arrow') },
              { key: 'markerEnd', label: 'Arrow at end', type: 'select', empty: 'none', options: flowChoices('arrow') },
              { key: 'dash', label: 'Dashes', type: 'select', options: flowChoices('dash') },
              { key: 'from', label: 'Leaves from', type: 'select', options: flowChoices('side') },
              { key: 'to', label: edgeEditor.member ? 'Side of the group' : 'Arrives at', type: 'select', options: flowChoices('side') },
              ...(edgeEditor.type === 'default' ? [{ key: 'bend', label: 'Curve bend (0 to 100)', type: 'number', least: 0, most: 100 }] : []),
              ...(edgeEditor.type === 'smoothstep' ? [{ key: 'corner', label: 'Corner rounding', type: 'number', least: 0, most: 40 }] : []),
              { key: 'labelSize', label: 'Label size', type: 'select', options: flowChoices('labelSize') },
              { key: 'labelBg', label: 'Label background', type: 'switch', wide: !['default', 'smoothstep'].includes(edgeEditor.type) }
            ]}
          />
        )}
      </Genie>

      <FlowLock.Provider value={readOnly}>
      <FlowActions.Provider value={canEdit ? actionsValue : null}>
      <ReactFlow
        nodes={shownNodes}
        edges={shownEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChangeHandler}
        onConnect={connectable && !readOnly ? onConnect : undefined}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={onConnectEndHandler}
        edgesReconnectable={connectable && !readOnly}
        onReconnect={(oldEdge, connection) => { if (oldEdge.type !== 'member') setEdges((current) => reconnectEdge(oldEdge, connection, current).map(sanitizeEdge)); }}
        snapToGrid={snap}
        snapGrid={[backgroundGap, backgroundGap]}
        onNodeClick={(e, node) => { setNodeEditor(null); setEdgeEditor(null); onNodeClick?.(e, node); }}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onContextMenu}
        onEdgeClick={(e, edge) => { setNodeEditor(null); setEdgeEditor(null); onEdgeClick?.(e, edge); }}
        onEdgeDoubleClick={readOnly ? undefined : (e, edge) => { if (edge.type !== 'member') openWriter(edge, false); }}
        onEdgeContextMenu={onEdgeContextMenuHandler}
        onPaneClick={onPaneClickHandler}
        onNodeDrag={readOnly ? undefined : onNodeDragHandler}
        onNodeDragStop={readOnly ? undefined : onNodeDragStopHandler}
        connectionMode={ConnectionMode.Loose}
        isValidConnection={validConnection}
        onBeforeDelete={canDelete}
        selectionMode={SelectionMode.Partial}
        minZoom={0.1}
        maxZoom={4}
        onlyRenderVisibleElements={nodes.length > 150}
        onPaneContextMenu={readOnly ? undefined : onPaneMenu}
        onMoveEnd={(_event, viewport) => keepView(viewport, pattern)}
        nodesDraggable={draggable && !readOnly && !locked}
        nodesConnectable={connectable && !readOnly}
        elementsSelectable={selectable}
        deleteKeyCode={deletable && !readOnly ? ['Backspace', 'Delete'] : null}
        zoomOnScroll={zoomable}
        panOnScroll={pannable}
        fitView={fitView && !savedView}
        fitViewOptions={fitViewOptions}
  proOptions={proOptions}
  onInit={handleInit}
        {...reactFlowProps}
      >
        {background && <Background variant={pattern} gap={backgroundGap} size={pattern === 'cross' ? 5 : backgroundSize} {...backgroundProps} />}
        {controls && toolbar === false && <Controls showInteractive={!readOnly} {...controlsProps} />}
        {toolbar !== false && (
          <Panel position="top-left" className="flow-toolbar">
            <ButtonGroup vertical selectable={false} size="xs">
              {FLOW_ACTIONS.filter((action) => !action.hidden && (action.kind === 'view' || canEdit)).map((action) => (
                <Button
                  key={action.id}
                  size="xs"
                  variant="ghost"
                  selected={(action.id === 'lock' && locked) || (action.id === 'map' && mapShown) || (action.id === 'snap' && snap) || (action.id === 'tidy' && arrangeOpen)}
                  disabled={Boolean(action.needs) && !actionReady[action.needs]}
                  title={`${action.label} (${action.keys})`}
                  aria-label={`${action.label} (${action.keys})`}
                  onClick={(event) => {
                    if (action.id !== 'tidy') return runAction(action.id);
                    arrangeAnchorRef.current = event.currentTarget;
                    return setArrangeOpen((open) => !open);
                  }}
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
        {children}
      </ReactFlow>
      </FlowActions.Provider>
      </FlowLock.Provider>
      </>
      )}
    </div>
  );
});

FlowCanvas.displayName = 'FlowCanvas';

export const Flow = forwardRef((props, ref) => (
  <ReactFlowProvider>
    <FlowCanvas {...props} ref={ref} />
  </ReactFlowProvider>
));

Flow.displayName = 'Flow';

export default Flow;
