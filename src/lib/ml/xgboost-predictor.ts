// 純 JS XGBoost tree traversal
// 從 Python 端 booster.get_dump(dump_format='json') 匯出的格式做推論
//
// XGBoost JSON tree 格式範例:
// {
//   "nodeid": 0,
//   "depth": 0,
//   "split": "f12",      // 分裂用的特徵 index ("f0", "f12", ...)
//   "split_condition": 0.5,
//   "yes": 1,            // value < condition 走的 nodeid
//   "no": 2,             // value >= condition 走的 nodeid
//   "missing": 1,        // 缺失值走哪
//   "children": [
//     { "nodeid": 1, "leaf": 0.123 },
//     { "nodeid": 2, "leaf": -0.456 }
//   ]
// }
// 葉子節點:{ "nodeid": N, "leaf": value }

interface TreeNode {
  nodeid: number;
  leaf?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  children?: TreeNode[];
}

interface XGBoostModelClass {
  trees: TreeNode[];
  base_score: number;
}

export interface XGBoostModelDump {
  num_classes: number;
  feature_dim: number;
  models: XGBoostModelClass[];
}

// 把扁平 children 結構建成 nodeid -> node 索引
function buildIndex(tree: TreeNode): Map<number, TreeNode> {
  const idx = new Map<number, TreeNode>();
  const walk = (node: TreeNode) => {
    idx.set(node.nodeid, node);
    if (node.children) node.children.forEach(walk);
  };
  walk(tree);
  return idx;
}

// 預先建好的索引 (避免每次推論都重建)
const treeIndexCache = new WeakMap<TreeNode, Map<number, TreeNode>>();

function getIndex(tree: TreeNode): Map<number, TreeNode> {
  let idx = treeIndexCache.get(tree);
  if (!idx) {
    idx = buildIndex(tree);
    treeIndexCache.set(tree, idx);
  }
  return idx;
}

function predictTree(tree: TreeNode, features: ArrayLike<number>): number {
  const idx = getIndex(tree);
  let node = tree;
  // 防無窮迴圈
  for (let depth = 0; depth < 64; depth++) {
    if (typeof node.leaf === 'number') return node.leaf;
    const splitFeat = parseInt((node.split ?? 'f0').slice(1), 10);
    const cond = node.split_condition ?? 0;
    const value = features[splitFeat];
    let nextId: number;
    if (value === undefined || Number.isNaN(value)) {
      nextId = node.missing ?? node.yes ?? 0;
    } else {
      nextId = value < cond ? (node.yes ?? 0) : (node.no ?? 0);
    }
    const next = idx.get(nextId);
    if (!next) return 0;
    node = next;
  }
  return 0;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * 對單一 binary classifier 做推論
 * 回傳 sigmoid(base_score_logit + Σ tree leaves)
 */
function predictSingleClass(model: XGBoostModelClass, features: ArrayLike<number>): number {
  // base_score 預設 0.5,對應 logit = 0
  // XGBoost binary:logistic 的輸出本身已是 logit (各樹相加),最後套 sigmoid
  let logit = 0;
  for (const tree of model.trees) {
    logit += predictTree(tree, features);
  }
  return sigmoid(logit);
}

/**
 * 對 39 個 binary classifier 各自推論,回傳 39 維機率向量
 */
export function predictAllClasses(
  dump: XGBoostModelDump,
  features: ArrayLike<number>
): number[] {
  const probs = new Array<number>(dump.num_classes);
  for (let i = 0; i < dump.num_classes; i++) {
    const m = dump.models[i];
    probs[i] = m && m.trees.length > 0 ? predictSingleClass(m, features) : 0.5;
  }
  return probs;
}
