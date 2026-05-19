import type { GraphLayoutMode } from '../types/graph'

export type GraphLayoutContext = {
  nodeCount: number
  incremental?: boolean
  focused?: boolean
}

export function getGraphLayoutMode(
  requested: GraphLayoutMode | undefined,
  nodeCount: number,
): GraphLayoutMode {
  if (requested) {
    return requested
  }

  return nodeCount > 120 ? 'cose-bilkent' : 'fcose'
}

export function buildGraphLayoutOptions(
  mode: GraphLayoutMode,
  context: GraphLayoutContext,
): Record<string, unknown> {
  const shouldReducePhysics = context.nodeCount > 180
  const shouldSimplify = context.nodeCount > 1000

  if (mode === 'breadthfirst') {
    return {
      name: 'breadthfirst',
      directed: true,
      padding: 32,
      animate: true,
      animationDuration: 420,
      spacingFactor: 1.2,
      nodeDimensionsIncludeLabels: false,
      fit: true,
    }
  }

  if (mode === 'concentric') {
    return {
      name: 'concentric',
      fit: true,
      padding: 30,
      animate: true,
      animationDuration: 480,
      spacingFactor: 1.1,
      concentric: (node: { degree: () => number }) => Math.max(node.degree(), 1),
      levelWidth: () => 1,
      equidistant: true,
      minNodeSpacing: 40,
      nodeDimensionsIncludeLabels: false,
    }
  }

  if (mode === 'cose-bilkent') {
    return {
      name: 'cose-bilkent',
      fit: true,
      padding: 30,
      animate: !shouldReducePhysics,
      animationDuration: context.incremental ? 220 : 420,
      randomize: true,
      nodeDimensionsIncludeLabels: false,
      numIter: shouldReducePhysics ? 600 : 1500,
      idealEdgeLength: shouldReducePhysics ? 90 : 110,
      nodeRepulsion: shouldReducePhysics ? 3200 : 4600,
      edgeElasticity: 0.08,
      gravity: 0.18,
      nestingFactor: 0.7,
      tile: false,
    }
  }

  return {
    name: 'fcose',
    quality: shouldSimplify ? 'proof' : 'default',
    animate: true,
    animationDuration: context.incremental ? 220 : 560,
    fit: true,
    padding: 30,
    randomize: true,
    nodeRepulsion: shouldReducePhysics ? 3200 : 4500,
    idealEdgeLength: shouldReducePhysics ? 92 : 110,
    edgeElasticity: 0.08,
    gravity: 0.22,
    nestingFactor: 0.7,
    numIter: shouldReducePhysics ? 1400 : 2500,
    initialEnergyOnIncremental: 0.18,
    nodeDimensionsIncludeLabels: false,
    tile: false,
    step: 'all',
    packComponents: false,
    samplingType: shouldSimplify ? 'greedy' : 'random',
    sampleSize: shouldSimplify ? 120 : 300,
  }
}
