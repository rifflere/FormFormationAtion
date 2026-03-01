import { useState, useRef } from "react";
import "./FormBuilder.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const INPUT_TYPES = ["text", "textarea", "number", "email", "select", "radio", "checkbox", "date"];

// ─── Factories ────────────────────────────────────────────────────────────────

const defaultCondition = () => ({
  id: crypto.randomUUID(),
  questionId: "",
  operator: "is",
  answer: "",
});

const defaultQuestion = () => ({
  id: crypto.randomUUID(),
  kind: "question",
  label: "",
  helperText: "",
  required: false,
  type: "text",
  options: "",
  conditions: [],
  conditionMode: "all",
});

const defaultContent = () => ({
  id: crypto.randomUUID(),
  kind: "content",
  title: "",
  body: "",
  imageUrl: "",
});

const defaultSection = () => ({
  id: crypto.randomUUID(),
  kind: "section",
  title: "New Section",
  description: "",
});

// ─── Default preloaded items ──────────────────────────────────────────────────

const defaultItems = () => [
  {
    id: crypto.randomUUID(),
    kind: "section",
    title: "Contact Info",
    description: "Please enter up-to-date contact information."
  },
  {
    id: crypto.randomUUID(),
    kind: "question",
    label: "Name",
    helperText: "Enter your name here",
    required: true,
    type: "text",
    options: "",
    conditions: [],
    conditionMode: "all",
  },
  {
    id: crypto.randomUUID(),
    kind: "question",
    label: "Email",
    helperText: "Enter your email here",
    required: true,
    type: "email",
    options: "",
    conditions: [],
    conditionMode: "all",
  },
  {
    id: crypto.randomUUID(),
    kind: "question",
    label: "I agree to terms and conditions",
    helperText: "",
    required: true,
    type: "radio",
    options: "Yes, No",
    conditions: [],
    conditionMode: "all",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDependentIds(targetId, allItems) {
  const result = new Set();
  const queue = [targetId];
  while (queue.length) {
    const id = queue.shift();
    allItems.forEach((q) => {
      if (q.kind !== "question") return;
      if (!result.has(q.id) && q.id !== targetId) {
        const deps = q.conditions.map((c) => c.questionId);
        if (deps.includes(id)) {
          result.add(q.id);
          queue.push(q.id);
        }
      }
    });
  }
  return result;
}

function getAnswerValue(answers, questionId) {
  const val = answers[questionId];
  if (Array.isArray(val)) return val;
  return (val ?? "").toString().trim();
}

function isEmpty(val) {
  if (Array.isArray(val)) return val.length === 0;
  return val === "" || val === null || val === undefined;
}

function evaluateConditions(item, answers, allItems) {
  if (item.kind !== "question") return true;
  if (!item.conditions || item.conditions.length === 0) return true;
  const active = item.conditions.filter((c) => c.questionId);
  if (active.length === 0) return true;

  const results = active.map((c) => {
    const val = getAnswerValue(answers, c.questionId);
    if (c.operator === "is_empty") return isEmpty(val);
    const expected = c.answer.trim().toLowerCase();
    const answerArr = Array.isArray(val) ? val.map((v) => v.toLowerCase()) : [val.toLowerCase()];
    const matches = answerArr.some((a) => a === expected);
    return c.operator === "is" ? matches : !matches;
  });

  return item.conditionMode === "all" ? results.every(Boolean) : results.some(Boolean);
}

function precedingQuestions(items, index) {
  return items.slice(0, index).filter((i) => i.kind === "question");
}

// ─── Drag-to-reorder hook ─────────────────────────────────────────────────────

function useDragReorder(items, setItems) {
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const onDragStart = (e, index) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const onDrop = (e, index) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) { setDragOverIndex(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    setItems(next);
    dragIndex.current = null;
    setDragOverIndex(null);
  };

  const onDragEnd = () => { dragIndex.current = null; setDragOverIndex(null); };

  return { onDragStart, onDragOver, onDrop, onDragEnd, dragOverIndex };
}

// ─── Confirmation Modal ───────────────────────────────────────────────────────

function ConfirmModal({ message, detail, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon">⚠️</div>
        <div className="modal-message">{message}</div>
        {detail && <div className="modal-detail">{detail}</div>}
        <div className="modal-actions">
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
          <button className="modal-confirm" onClick={onConfirm}>Delete anyway</button>
        </div>
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ item, onRemove, onChange, dragHandleProps }) {
  const update = (field, value) => onChange({ ...item, [field]: value });
  return (
    <div className="qcard section-card">
      <div className="qcard-header">
        <div className="drag-handle" {...dragHandleProps}>⠿</div>
        <span className="section-badge">SECTION</span>
        <button className="remove-btn" onClick={onRemove} title="Remove section">×</button>
      </div>
      <div className="field-row">
        <label>Section Title</label>
        <input type="text" placeholder="Section heading" value={item.title} onChange={(e) => update("title", e.target.value)} />
      </div>
      <div className="field-row">
        <label>Description <span className="hint">(optional)</span></label>
        <input type="text" placeholder="Short description shown below the heading" value={item.description} onChange={(e) => update("description", e.target.value)} />
      </div>
    </div>
  );
}

// ─── Content Block Card ───────────────────────────────────────────────────────

function ContentCard({ item, onRemove, onChange, dragHandleProps }) {
  const update = (field, value) => onChange({ ...item, [field]: value });
  return (
    <div className="qcard content-card">
      <div className="qcard-header">
        <div className="drag-handle" {...dragHandleProps}>⠿</div>
        <span className="content-badge">CONTENT</span>
        <button className="remove-btn" onClick={onRemove} title="Remove block">×</button>
      </div>
      <div className="field-row">
        <label>Title <span className="hint">(optional)</span></label>
        <input type="text" placeholder="Block title" value={item.title} onChange={(e) => update("title", e.target.value)} />
      </div>
      <div className="field-row">
        <label>Body Text <span className="hint">(optional)</span></label>
        <textarea rows={3} placeholder="Informational text, instructions, etc." value={item.body} onChange={(e) => update("body", e.target.value)} />
      </div>
      <div className="field-row">
        <label>Image URL <span className="hint">(optional)</span></label>
        <input type="text" placeholder="https://example.com/image.png" value={item.imageUrl} onChange={(e) => update("imageUrl", e.target.value)} />
      </div>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────

function QuestionCard({ item, index, allItems, onChange, onRemove, dragHandleProps }) {
  const preceding = precedingQuestions(allItems, index);
  const needsOptions = ["select", "radio", "checkbox"].includes(item.type);

  const update = (field, value) => onChange({ ...item, [field]: value });
  const addCondition = () => update("conditions", [...item.conditions, defaultCondition()]);
  const removeCondition = (id) => update("conditions", item.conditions.filter((c) => c.id !== id));
  const updateCondition = (id, field, value) =>
    update("conditions", item.conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c)));

  const qNum = allItems.slice(0, index).filter((i) => i.kind === "question").length + 1;

  return (
    <div className="qcard">
      <div className="qcard-header">
        <div className="drag-handle" {...dragHandleProps}>⠿</div>
        <span className="qcard-num">Q{qNum}</span>
        <button className="remove-btn" onClick={onRemove} title="Remove question">×</button>
      </div>

      <div className="field-row">
        <label>Label</label>
        <input type="text" placeholder="Question label" value={item.label} onChange={(e) => update("label", e.target.value)} />
      </div>
      <div className="field-row">
        <label>Helper Text</label>
        <input type="text" placeholder="Optional description" value={item.helperText} onChange={(e) => update("helperText", e.target.value)} />
      </div>

      <div className="field-row two-col">
        <div>
          <label>Input Type</label>
          <select value={item.type} onChange={(e) => update("type", e.target.value)}>
            {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="required-toggle">
          <label>Required</label>
          <button className={`toggle ${item.required ? "on" : "off"}`} onClick={() => update("required", !item.required)}>
            {item.required ? "Yes" : "No"}
          </button>
        </div>
      </div>

      {needsOptions && (
        <div className="field-row">
          <label>Options <span className="hint">(comma-separated)</span></label>
          <input type="text" placeholder="Option A, Option B, Option C" value={item.options} onChange={(e) => update("options", e.target.value)} />
        </div>
      )}

      {preceding.length > 0 && (
        <div className="depends-on">
          <div className="depends-label-row">
            <span className="depends-label">Conditional Logic</span>
            {item.conditions.length > 1 && (
              <div className="condition-mode">
                <span>Match</span>
                <select value={item.conditionMode} onChange={(e) => update("conditionMode", e.target.value)}>
                  <option value="all">ALL</option>
                  <option value="any">ANY</option>
                </select>
                <span>conditions</span>
              </div>
            )}
          </div>
          {item.conditions.map((cond, ci) => (
            <div key={cond.id} className="condition-row">
              <span className="condition-index">{ci + 1}</span>
              <select value={cond.questionId} onChange={(e) => updateCondition(cond.id, "questionId", e.target.value)}>
                <option value="">— question —</option>
                {preceding.map((q, i) => (
                  <option key={q.id} value={q.id}>Q{i + 1}: {q.label || "(unlabeled)"}</option>
                ))}
              </select>
              <select value={cond.operator} onChange={(e) => updateCondition(cond.id, "operator", e.target.value)}>
                <option value="is">is</option>
                <option value="is_not">is not</option>
                <option value="is_empty">is empty</option>
              </select>
              {cond.operator !== "is_empty" && (
                <input type="text" placeholder="answer" value={cond.answer} disabled={!cond.questionId} onChange={(e) => updateCondition(cond.id, "answer", e.target.value)} />
              )}
              <button className="remove-condition-btn" onClick={() => removeCondition(cond.id)} title="Remove condition">×</button>
            </div>
          ))}
          <button className="add-condition-btn" onClick={addCondition}>+ Add Condition</button>
        </div>
      )}
    </div>
  );
}

// ─── Live Form Preview ────────────────────────────────────────────────────────

function FormPreview({ formName, items }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const setAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    if (errors[id]) setErrors((prev) => { const e = { ...prev }; delete e[id]; return e; });
  };

  const toggleCheckbox = (id, option) => {
    const current = answers[id] ?? [];
    const next = current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
    setAnswer(id, next);
  };

  const resetForm = () => { setAnswers({}); setSubmitted(false); setErrors({}); };

  const handleSubmit = () => {
    const newErrors = {};
    items.forEach((q) => {
      if (q.kind !== "question") return;
      if (!evaluateConditions(q, answers, items)) return;
      if (!q.required) return;
      if (isEmpty(getAnswerValue(answers, q.id))) newErrors[q.id] = true;
    });
    if (Object.keys(newErrors).length > 0) setErrors(newErrors);
    else setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="preview-panel">
        <div className="panel-title preview-header"><span>Live Preview</span></div>
        <div className="preview-success">
          <div className="success-icon">✓</div>
          <div className="success-msg">Form submitted!</div>
          <button className="reset-btn" onClick={resetForm}>Start over</button>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel">
      <div className="panel-title preview-header">
        <span>Live Preview</span>
        <button className="reset-btn" onClick={resetForm}>Reset</button>
      </div>

      {formName && <div className="preview-form-title">{formName}</div>}

      {items.length === 0 ? (
        <p className="preview-empty">No items yet.</p>
      ) : (
        <>
          <div className="preview-form">
            {items.map((item) => {
              if (item.kind === "section") {
                return (
                  <div key={item.id} className="preview-section">
                    <div className="preview-section-title">{item.title || <em>Untitled section</em>}</div>
                    {item.description && <div className="preview-section-desc">{item.description}</div>}
                  </div>
                );
              }
              if (item.kind === "content") {
                return (
                  <div key={item.id} className="preview-content">
                    {item.title && <div className="preview-content-title">{item.title}</div>}
                    {item.body && <div className="preview-content-body">{item.body}</div>}
                    {item.imageUrl && (
                      <img className="preview-content-img" src={item.imageUrl} alt={item.title || "Content image"} onError={(e) => { e.target.style.display = "none"; }} />
                    )}
                  </div>
                );
              }

              const visible = evaluateConditions(item, answers, items);
              const opts = item.options ? item.options.split(",").map((s) => s.trim()).filter(Boolean) : [];
              const hasError = errors[item.id];

              return (
                <div key={item.id} className={`preview-field ${visible ? "preview-visible" : "preview-hidden"} ${hasError ? "has-error" : ""}`}>
                  <label className="preview-label">
                    {item.label || <em>Unlabeled question</em>}
                    {item.required && <span className="required-star">*</span>}
                  </label>
                  {item.helperText && <span className="preview-helper">{item.helperText}</span>}
                  {hasError && <span className="preview-error">This field is required.</span>}
                  {visible && (
                    <>
                      {item.type === "textarea" && <textarea rows={3} value={answers[item.id] ?? ""} onChange={(e) => setAnswer(item.id, e.target.value)} />}
                      {["text", "email", "number", "date"].includes(item.type) && (
                        <input type={item.type} value={answers[item.id] ?? ""} onChange={(e) => setAnswer(item.id, e.target.value)} />
                      )}
                      {item.type === "select" && (
                        <select value={answers[item.id] ?? ""} onChange={(e) => setAnswer(item.id, e.target.value)}>
                          <option value="">— select —</option>
                          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {item.type === "radio" && (
                        <div className="preview-options">
                          {opts.map((o) => (
                            <label key={o} className="preview-option">
                              <input type="radio" name={item.id} value={o} checked={(answers[item.id] ?? "") === o} onChange={() => setAnswer(item.id, o)} />
                              {o}
                            </label>
                          ))}
                        </div>
                      )}
                      {item.type === "checkbox" && (
                        <div className="preview-options">
                          {opts.map((o) => (
                            <label key={o} className="preview-option">
                              <input type="checkbox" value={o} checked={(answers[item.id] ?? []).includes(o)} onChange={() => toggleCheckbox(item.id, o)} />
                              {o}
                            </label>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <button className="submit-btn" onClick={handleSubmit}>Submit</button>
        </>
      )}
    </div>
  );
}

// ─── JSON serialiser ──────────────────────────────────────────────────────────

function toJSON(formId, formName, items) {
  return {
    formId,
    formName: formName || "Untitled Form",
    fields: items.map((item) => {
      if (item.kind === "section") {
        return { id: item.id, kind: "section", title: item.title, ...(item.description && { description: item.description }) };
      }
      if (item.kind === "content") {
        return {
          id: item.id,
          kind: "content",
          ...(item.title && { title: item.title }),
          ...(item.body && { body: item.body }),
          ...(item.imageUrl && { imageUrl: item.imageUrl }),
        };
      }
      const obj = { id: item.id, kind: "question", label: item.label, type: item.type, required: item.required };
      if (item.helperText) obj.helperText = item.helperText;
      if (["select", "radio", "checkbox"].includes(item.type) && item.options) {
        obj.options = item.options.split(",").map((s) => s.trim()).filter(Boolean);
      }
      const activeConditions = item.conditions.filter((c) => c.questionId);
      if (activeConditions.length > 0) {
        obj.conditions = activeConditions.map(({ questionId, operator, answer }) => ({
          questionId, operator, ...(operator !== "is_empty" && { answer }),
        }));
        obj.conditionMode = item.conditionMode;
      }
      return obj;
    }),
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Stable form ID generated once
  const formId = useRef(crypto.randomUUID()).current;

  const [formName, setFormName] = useState("");
  const [items, setItems] = useState(defaultItems());
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const drag = useDragReorder(items, setItems);

  const addQuestion = () => setItems((prev) => [...prev, defaultQuestion()]);
  const addContent  = () => setItems((prev) => [...prev, defaultContent()]);
  const addSection  = () => setItems((prev) => [...prev, defaultSection()]);

  const requestRemove = (id) => {
    const item = items.find((x) => x.id === id);
    if (item?.kind !== "question") {
      setItems((prev) => prev.filter((x) => x.id !== id));
      return;
    }
    const depIds = getDependentIds(id, items);
    if (depIds.size === 0) {
      setItems((prev) => prev.filter((x) => x.id !== id));
    } else {
      const depLabels = [...depIds].map((did) => {
        const idx = items.findIndex((q) => q.id === did);
        const q = items[idx];
        return `Q${idx + 1}${q.label ? ` (${q.label})` : ""}`;
      });
      setPendingDelete({ id, depIds, depLabels });
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const { id, depIds } = pendingDelete;
    setItems((prev) => prev.filter((x) => x.id !== id && !depIds.has(x.id)));
    setPendingDelete(null);
  };

  const updateItem = (id, updated) =>
    setItems((prev) => prev.map((x) => (x.id === id ? updated : x)));

  const jsonOutput = JSON.stringify(toJSON(formId, formName, items), null, 2);

  const copyJSON = () => {
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {pendingDelete && (
        <ConfirmModal
          message={`This question is referenced by ${pendingDelete.depLabels.length} other question${pendingDelete.depLabels.length > 1 ? "s" : ""}.`}
          detail={`Deleting it will also remove: ${pendingDelete.depLabels.join(", ")}.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      <div className="app">
        {/* ── Header ── */}
        <div className="header">
          <div className="header-left">
            <h1>FormFormAtionAtion</h1>
            <p>Build form schemas with a live preview and export as JSON</p>
          </div>
          <div className="form-name-wrap">
            <label className="form-name-label">Form Name</label>
            <input
              className="form-name-input"
              type="text"
              placeholder="Untitled Form"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <span className="form-id-badge" title="Form ID (auto-generated)">ID: {formId.slice(0, 8)}…</span>
          </div>
        </div>

        {/* ── Builder panel ── */}
        <div className="left-panel">
          <div className="panel-title">Items</div>

          {items.map((item, index) => {
            const dragProps = {
              draggable: true,
              onDragStart: (e) => drag.onDragStart(e, index),
              onDragOver:  (e) => drag.onDragOver(e, index),
              onDrop:      (e) => drag.onDrop(e, index),
              onDragEnd:   drag.onDragEnd,
            };
            const dragHandleProps = { onMouseDown: () => {} };
            const wrapClass = `drag-item ${drag.dragOverIndex === index ? "drag-over" : ""}`;

            return (
              <div key={item.id} className={wrapClass} {...dragProps}>
                {item.kind === "section"  && <SectionCard  item={item} onRemove={() => requestRemove(item.id)} onChange={(u) => updateItem(item.id, u)} dragHandleProps={dragHandleProps} />}
                {item.kind === "content"  && <ContentCard  item={item} onRemove={() => requestRemove(item.id)} onChange={(u) => updateItem(item.id, u)} dragHandleProps={dragHandleProps} />}
                {item.kind === "question" && <QuestionCard item={item} index={index} allItems={items} onChange={(u) => updateItem(item.id, u)} onRemove={() => requestRemove(item.id)} dragHandleProps={dragHandleProps} />}
              </div>
            );
          })}

          <div className="add-btn-group">
            <button className="add-btn" onClick={addQuestion}>+ Question</button>
            <button className="add-btn add-btn-content" onClick={addContent}>+ Content Block</button>
            <button className="add-btn add-btn-section" onClick={addSection}>+ Section</button>
          </div>
        </div>

        {/* ── JSON panel ── */}
        <div className="right-panel">
          <div className="panel-title json-header">
            <span>JSON Output</span>
            <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyJSON}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="json-box">{jsonOutput}</div>
        </div>

        {/* ── Preview panel ── */}
        <FormPreview formName={formName} items={items} />
      </div>
    </>
  );
}