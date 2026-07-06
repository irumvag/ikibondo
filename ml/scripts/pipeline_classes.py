"""
Shared pipeline class definitions for Ikibondo lightweight ML models.

Importing from this module (not __main__) ensures pickle can always resolve
the classes regardless of how/where the model is loaded.

Used by:
  - train_malnutrition_simple.py
  - train_vaccination_simple.py
  - train_growth_simple.py
  - backend/apps/ml_engine/loader.py  (registers this module for pickle)
"""
import numpy as np


def sigmoid(z):
    return 1 / (1 + np.exp(-np.clip(z, -500, 500)))


# ── Malnutrition Decision Tree ─────────────────────────────────────────────────

class _Node:
    __slots__ = ['feature', 'threshold', 'left', 'right', 'label', 'proba']
    def __init__(self):
        self.feature = self.threshold = self.left = self.right = self.label = None
        self.proba = None


class SimpleDecisionTree:
    def __init__(self, max_depth=10, min_samples_split=20, class_weight=None):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.class_weight = class_weight
        self.root = None
        self.classes_ = None

    def fit(self, X, y):
        self.classes_ = np.unique(y)
        self.root = self._build(X, y, depth=0)
        return self

    def _gini(self, y):
        if len(y) == 0:
            return 0.0
        classes, counts = np.unique(y, return_counts=True)
        probs = counts / len(y)
        if self.class_weight:
            weighted = np.array([probs[i] * self.class_weight.get(c, 1.0)
                                  for i, c in enumerate(classes)])
            probs = weighted / weighted.sum() if weighted.sum() > 0 else probs
        return 1.0 - np.sum(probs ** 2)

    def _best_split(self, X, y):
        best_gain, best_feat, best_thresh = -1, None, None
        parent_gini = self._gini(y)
        n = len(y)
        for feat in range(X.shape[1]):
            thresholds = np.percentile(X[:, feat], [20, 40, 60, 80])
            for thresh in np.unique(thresholds):
                left_mask  = X[:, feat] <= thresh
                right_mask = ~left_mask
                if left_mask.sum() < 5 or right_mask.sum() < 5:
                    continue
                gain = parent_gini - (
                    left_mask.sum()  / n * self._gini(y[left_mask]) +
                    right_mask.sum() / n * self._gini(y[right_mask])
                )
                if gain > best_gain:
                    best_gain, best_feat, best_thresh = gain, feat, thresh
        return best_feat, best_thresh

    def _build(self, X, y, depth):
        node = _Node()
        counts = {c: np.sum(y == c) for c in self.classes_}
        total = len(y)
        node.proba = {c: counts[c] / total for c in self.classes_}
        node.label = max(counts, key=counts.get)
        if depth >= self.max_depth or len(y) < self.min_samples_split or len(np.unique(y)) == 1:
            return node
        feat, thresh = self._best_split(X, y)
        if feat is None:
            return node
        node.feature   = feat
        node.threshold = thresh
        left_mask  = X[:, feat] <= thresh
        right_mask = ~left_mask
        node.left  = self._build(X[left_mask],  y[left_mask],  depth + 1)
        node.right = self._build(X[right_mask], y[right_mask], depth + 1)
        return node

    def _predict_one(self, x, node):
        if node.feature is None:
            return node.label, node.proba
        if x[node.feature] <= node.threshold:
            return self._predict_one(x, node.left)
        return self._predict_one(x, node.right)

    def predict(self, X):
        return np.array([self._predict_one(x, self.root)[0] for x in X])

    def predict_proba(self, X):
        rows = []
        for x in X:
            _, proba_dict = self._predict_one(x, self.root)
            rows.append([proba_dict.get(c, 0.0) for c in self.classes_])
        return np.array(rows)


class MalnutritionPipeline:
    def __init__(self, tree, feature_names, classes, mean, std):
        self.tree = tree
        self.feature_names = feature_names
        self.classes_ = classes
        self._mean = mean
        self._std  = std

    def _prepare(self, X_df):
        import pandas as pd
        for col in self.feature_names:
            if col not in X_df.columns:
                X_df[col] = 0.0
        X = X_df[self.feature_names].values.astype(float)
        return (X - self._mean) / (self._std + 1e-8)

    def predict(self, X_df):
        return self.tree.predict(self._prepare(X_df))

    def predict_proba(self, X_df):
        return self.tree.predict_proba(self._prepare(X_df))

    def inverse_transform(self, y):
        return y

    class _LE:
        def __init__(self, classes): self.classes_ = classes
        def inverse_transform(self, y): return y

    @property
    def le_(self): return self._LE(self.classes_)


# ── Vaccination Logistic Regression ───────────────────────────────────────────

class LogisticRegressionNP:
    def __init__(self, lr=0.01, epochs=500, l2=0.01, class_weight='balanced'):
        self.lr = lr
        self.epochs = epochs
        self.l2 = l2
        self.class_weight = class_weight
        self.w = None
        self.b = 0.0
        self.classes_ = np.array([0, 1])

    def fit(self, X, y):
        n, d = X.shape
        self.w = np.zeros(d)
        self.b = 0.0
        if self.class_weight == 'balanced':
            pos = y.sum(); neg = n - pos
            sw = np.where(y == 1, n / (2 * pos), n / (2 * neg))
        else:
            sw = np.ones(n)
        for epoch in range(self.epochs):
            z = X @ self.w + self.b
            p = sigmoid(z)
            err = (p - y) * sw
            grad_w = (X.T @ err) / n + self.l2 * self.w
            grad_b = err.mean()
            self.w -= self.lr * grad_w
            self.b -= self.lr * grad_b
        return self

    def predict_proba(self, X):
        p_pos = sigmoid(X @ self.w + self.b)
        return np.column_stack([1 - p_pos, p_pos])

    def predict(self, X):
        return (sigmoid(X @ self.w + self.b) >= 0.5).astype(int)


class VaccinationPipeline:
    def __init__(self, model, feature_names, mean, std):
        self.model = model
        self.feature_names = feature_names
        self.classes_ = model.classes_
        self._mean = mean
        self._std  = std

    def _prepare(self, X_df):
        for col in self.feature_names:
            if col not in X_df.columns:
                X_df[col] = 0.0
        X = X_df[self.feature_names].values.astype(float)
        return (X - self._mean) / (self._std + 1e-8)

    def predict(self, X_df):
        return self.model.predict(self._prepare(X_df))

    def predict_proba(self, X_df):
        return self.model.predict_proba(self._prepare(X_df))


class VaccinationEnsemblePipeline:
    """
    Dropout predictor backed by a bootstrap ensemble of SimpleDecisionTree models.
    Replaces the logistic regression variant for higher AUC on imbalanced data.
    """
    def __init__(self, trees, feature_names, classes, mean, std):
        self.trees = trees
        self.feature_names = feature_names
        self.classes_ = classes
        self._mean = mean
        self._std  = std

    def _prepare(self, X_df):
        import pandas as pd
        if isinstance(X_df, pd.DataFrame):
            for col in self.feature_names:
                if col not in X_df.columns:
                    X_df[col] = 0.0
            X = X_df[self.feature_names].values.astype(float)
        else:
            X = X_df.astype(float)
        return (X - self._mean) / (self._std + 1e-8)

    def predict_proba(self, X_df):
        Xs = self._prepare(X_df)
        all_probas = np.array([t.predict_proba(Xs) for t in self.trees])
        return all_probas.mean(axis=0)

    def predict(self, X_df):
        proba = self.predict_proba(X_df)
        return self.classes_[np.argmax(proba, axis=1)]


# ── Growth Neural Network ──────────────────────────────────────────────────────

class GrowthNeuralNetwork:
    """Pure NumPy feedforward NN: input(15) → hidden(32) → hidden(16) → output(1)."""

    def __init__(self, input_dim=15, hidden1=32, hidden2=16, lr=0.001):
        self.lr = lr
        rng = np.random.default_rng(42)
        self.W1 = rng.normal(0, np.sqrt(2.0 / input_dim), (input_dim, hidden1))
        self.b1 = np.zeros(hidden1)
        self.W2 = rng.normal(0, np.sqrt(2.0 / hidden1), (hidden1, hidden2))
        self.b2 = np.zeros(hidden2)
        self.W3 = rng.normal(0, np.sqrt(2.0 / hidden2), (hidden2, 1))
        self.b3 = np.zeros(1)
        self.mean_ = None
        self.std_ = None
        self.classes_ = np.array(['stable', 'risk'])

    def _relu(self, x):
        return np.maximum(0, x)

    def _sigmoid(self, x):
        return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))

    def _forward(self, X):
        self.z1 = X @ self.W1 + self.b1
        self.a1 = self._relu(self.z1)
        self.z2 = self.a1 @ self.W2 + self.b2
        self.a2 = self._relu(self.z2)
        self.z3 = self.a2 @ self.W3 + self.b3
        self.a3 = self._sigmoid(self.z3)
        return self.a3

    def _backward(self, X, y):
        m = len(y)
        y = y.reshape(-1, 1)
        dz3 = self.a3 - y
        dW3 = (self.a2.T @ dz3) / m
        db3 = dz3.mean(axis=0)
        da2 = dz3 @ self.W3.T
        dz2 = da2 * (self.z2 > 0)
        dW2 = (self.a1.T @ dz2) / m
        db2 = dz2.mean(axis=0)
        da1 = dz2 @ self.W2.T
        dz1 = da1 * (self.z1 > 0)
        dW1 = (X.T @ dz1) / m
        db1 = dz1.mean(axis=0)
        self.W3 -= self.lr * dW3
        self.b3 -= self.lr * db3
        self.W2 -= self.lr * dW2
        self.b2 -= self.lr * db2
        self.W1 -= self.lr * dW1
        self.b1 -= self.lr * db1

    def fit(self, X, y, epochs=100, batch_size=64, verbose=True):
        self.mean_ = X.mean(axis=0)
        self.std_ = X.std(axis=0) + 1e-8
        X_norm = (X - self.mean_) / self.std_
        pos_idx = np.where(y == 1)[0]
        neg_idx = np.where(y == 0)[0]
        if len(pos_idx) < len(neg_idx):
            rng = np.random.default_rng(42)
            extra = rng.choice(pos_idx, size=len(neg_idx) - len(pos_idx), replace=True)
            all_idx = np.concatenate([np.arange(len(y)), extra])
            X_norm = X_norm[all_idx]
            y = y[all_idx]
        best_loss = float('inf')
        patience_counter = 0
        for epoch in range(epochs):
            idx = np.random.permutation(len(y))
            X_shuf, y_shuf = X_norm[idx], y[idx]
            epoch_loss, n_batches = 0, 0
            for i in range(0, len(y), batch_size):
                X_b, y_b = X_shuf[i:i + batch_size], y_shuf[i:i + batch_size]
                preds = self._forward(X_b)
                self._backward(X_b, y_b)
                eps = 1e-7
                loss = -np.mean(
                    y_b * np.log(preds.flatten() + eps) +
                    (1 - y_b) * np.log(1 - preds.flatten() + eps)
                )
                epoch_loss += loss
                n_batches += 1
            avg_loss = epoch_loss / n_batches
            if avg_loss < best_loss - 0.001:
                best_loss = avg_loss
                patience_counter = 0
            else:
                patience_counter += 1
                if patience_counter >= 15:
                    if verbose:
                        print(f'  Early stopping at epoch {epoch + 1}')
                    break
            if verbose and (epoch + 1) % 10 == 0:
                print(f'  Epoch {epoch + 1:3d} | Loss: {avg_loss:.4f}')
        return self

    def predict_proba(self, X):
        import pandas as pd
        if isinstance(X, pd.DataFrame):
            X = X.values.astype(np.float64)
        X_norm = (X - self.mean_) / self.std_
        prob = self._forward(X_norm).flatten()
        return np.column_stack([1 - prob, prob])

    def predict(self, X):
        proba = self.predict_proba(X)
        return (proba[:, 1] >= 0.5).astype(int)


class GrowthPipeline:
    """Wraps GrowthNeuralNetwork for pickle-safe deserialization."""

    def __init__(self, input_dim=15):
        self.model = GrowthNeuralNetwork(input_dim=input_dim)
        self.classes_ = np.array(['stable', 'risk'])

    def fit(self, X, y, **kwargs):
        self.model.fit(X, y, **kwargs)
        return self

    def predict(self, X):
        import pandas as pd
        if isinstance(X, pd.DataFrame):
            X = X.values.astype(np.float64)
        return self.model.predict(X)

    def predict_proba(self, X):
        import pandas as pd
        if isinstance(X, pd.DataFrame):
            X = X.values.astype(np.float64)
        return self.model.predict_proba(X)
