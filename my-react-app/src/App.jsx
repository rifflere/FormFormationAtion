import { useState } from "react";
import "./App.css";

const INPUT_TYPES = ["text", "textarea", "number", "email", "select", "radio", "checkbox", "date"];

const defaultCondition = () => ({
  id: crypto.randomUUID(),
  questionId: "",
  operator: "is",   // "is" | "is_not"
  answer: "",
});

const defaultQuestion = () => ({
  id: crypto.randomUUID(),
  label: "",
  helperText: "",
  required: false,
  type: "text",
  options: "",
  conditions: [],       // array of condition objects
  conditionMode: "all", // "all" | "any"
});

// ─── Condition evaluation ─────────────────────────────────────────────────────

function evaluateConditions(question, answers, allQuestions) {
  if (!question.conditions || question.conditions.length === 0) return true;

  const activeConditions = question.conditions.filter((c) => c.questionId);
  if (activeConditions.length === 0) return true;

  const results = activeConditions.map((c) => {
    const refQuestion = allQuestions.find((q) => q.id === c.questionId);
    if (!refQuestion) return true;

    const currentAnswer = (answers[c.questionId] ?? "").toString().trim().toLowerCase();
    const expected = c.answer.trim().toLowerCase();

    // For checkboxes the answer is an array of strings
    const answerArr = Array.isArray(answers[c.questionId])
      ? answers[c.questionId].map((v) => v.toLowerCase())
      : [currentAnswer];

    const matches = answerArr.some((a) => a === expected);
    return c.operator === "is" ? matches : !matches;
  });

  return question.conditionMode === "all"
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ─── Question Card (builder) ──────────────────────────────────────────────────

function QuestionCard({ question, index, questions, onChange, onRemove }) {
  const precedingQuestions = questions.slice(0, index);
  const needsOptions = ["select", "radio", "checkbox"].includes(question.type);

  const update = (field, value) => onChange({ ...question, [field]: value });

  const addCondition = () =>
    update("conditions", [...question.conditions, defaultCondition()]);

  const removeCondition = (id) =>
    update("conditions", question.conditions.filter((c) => c.id !== id));

  const updateCondition = (id, field, value) =>
    update(
      "conditions",
      question.conditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );

  return (
    <div className="qcard">
      <div className="qcard-header">
        <span className="qcard-num">Q{index + 1}</span>
        <button className="remove-btn" onClick={onRemove} title="Remove question">×</button>
      </div>

      <div className="field-row">
        <label>Label</label>
        <input
          type="text"
          placeholder="Question label"
          value={question.label}
          onChange={(e) => update("label", e.target.value)}
        />
      </div>

      <div className="field-row">
        <label>Helper Text</label>
        <input
          type="text"
          placeholder="Optional description"
          value={question.helperText}
          onChange={(e) => update("helperText", e.target.value)}
        />
      </div>

      <div className="field-row two-col">
        <div>
          <label>Input Type</label>
          <select value={question.type} onChange={(e) => update("type", e.target.value)}>
            {INPUT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="required-toggle">
          <label>Required</label>
          <button
            className={`toggle ${question.required ? "on" : "off"}`}
            onClick={() => update("required", !question.required)}
          >
            {question.required ? "Yes" : "No"}
          </button>
        </div>
      </div>

      {needsOptions && (
        <div className="field-row">
          <label>Options <span className="hint">(comma-separated)</span></label>
          <input
            type="text"
            placeholder="Option A, Option B, Option C"
            value={question.options}
            onChange={(e) => update("options", e.target.value)}
          />
        </div>
      )}

      {/* ── Conditional Logic ── */}
      {precedingQuestions.length > 0 && (
        <div className="depends-on">
          <div className="depends-label-row">
            <span className="depends-label">Conditional Logic</span>
            {question.conditions.length > 1 && (
              <div className="condition-mode">
                <span>Match</span>
                <select
                  value={question.conditionMode}
                  onChange={(e) => update("conditionMode", e.target.value)}
                >
                  <option value="all">ALL</option>
                  <option value="any">ANY</option>
                </select>
                <span>conditions</span>
              </div>
            )}
          </div>

          {question.conditions.map((cond, ci) => (
            <div key={cond.id} className="condition-row">
              <span className="condition-index">{ci + 1}</span>

              <select
                value={cond.questionId}
                onChange={(e) => updateCondition(cond.id, "questionId", e.target.value)}
              >
                <option value="">— question —</option>
                {precedingQuestions.map((q, i) => (
                  <option key={q.id} value={q.id}>
                    Q{i + 1}: {q.label || "(unlabeled)"}
                  </option>
                ))}
              </select>

              <select
                value={cond.operator}
                onChange={(e) => updateCondition(cond.id, "operator", e.target.value)}
              >
                <option value="is">is</option>
                <option value="is_not">is not</option>
              </select>

              <input
                type="text"
                placeholder="answer"
                value={cond.answer}
                disabled={!cond.questionId}
                onChange={(e) => updateCondition(cond.id, "answer", e.target.value)}
              />

              <button
                className="remove-condition-btn"
                onClick={() => removeCondition(cond.id)}
                title="Remove condition"
              >×</button>
            </div>
          ))}

          <button className="add-condition-btn" onClick={addCondition}>
            + Add Condition
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Live Form Preview ────────────────────────────────────────────────────────

function FormPreview({ questions }) {
  const [answers, setAnswers] = useState({});

  const setAnswer = (id, value) => setAnswers((prev) => ({ ...prev, [id]: value }));

  const toggleCheckbox = (id, option) => {
    const current = answers[id] ?? [];
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAnswer(id, next);
  };

  const resetForm = () => setAnswers({});

  const visibleQuestions = questions.filter((q) =>
    evaluateConditions(q, answers, questions)
  );

  return (
    <div className="preview-panel">
      <div className="panel-title preview-header">
        <span>Live Preview</span>
        <button className="reset-btn" onClick={resetForm}>Reset</button>
      </div>

      {questions.length === 0 ? (
        <p className="preview-empty">No questions yet.</p>
      ) : (
        <div className="preview-form">
          {questions.map((q) => {
            const visible = evaluateConditions(q, answers, questions);
            const opts = q.options
              ? q.options.split(",").map((s) => s.trim()).filter(Boolean)
              : [];

            return (
              <div
                key={q.id}
                className={`preview-field ${visible ? "preview-visible" : "preview-hidden"}`}
              >
                <label className="preview-label">
                  {q.label || <em>Unlabeled question</em>}
                  {q.required && <span className="required-star">*</span>}
                </label>

                {q.helperText && (
                  <span className="preview-helper">{q.helperText}</span>
                )}

                {visible && (
                  <>
                    {q.type === "textarea" && (
                      <textarea
                        rows={3}
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    )}

                    {(q.type === "text" || q.type === "email" || q.type === "number" || q.type === "date") && (
                      <input
                        type={q.type}
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      />
                    )}

                    {q.type === "select" && (
                      <select
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                      >
                        <option value="">— select —</option>
                        {opts.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    )}

                    {q.type === "radio" && (
                      <div className="preview-options">
                        {opts.map((o) => (
                          <label key={o} className="preview-option">
                            <input
                              type="radio"
                              name={q.id}
                              value={o}
                              checked={(answers[q.id] ?? "") === o}
                              onChange={() => setAnswer(q.id, o)}
                            />
                            {o}
                          </label>
                        ))}
                      </div>
                    )}

                    {q.type === "checkbox" && (
                      <div className="preview-options">
                        {opts.map((o) => (
                          <label key={o} className="preview-option">
                            <input
                              type="checkbox"
                              value={o}
                              checked={(answers[q.id] ?? []).includes(o)}
                              onChange={() => toggleCheckbox(q.id, o)}
                            />
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
      )}
    </div>
  );
}

// ─── JSON serialiser ──────────────────────────────────────────────────────────

function toJSON(questions) {
  return questions.map((q) => {
    const obj = {
      id: q.id,
      label: q.label,
      type: q.type,
      required: q.required,
    };
    if (q.helperText) obj.helperText = q.helperText;
    if (["select", "radio", "checkbox"].includes(q.type) && q.options) {
      obj.options = q.options.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const activeConditions = q.conditions.filter((c) => c.questionId);
    if (activeConditions.length > 0) {
      obj.conditions = activeConditions.map(({ questionId, operator, answer }) => ({
        questionId,
        operator,
        answer,
      }));
      obj.conditionMode = q.conditionMode;
    }
    return obj;
  });
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [questions, setQuestions] = useState([defaultQuestion()]);
  const [copied, setCopied] = useState(false);

  const addQuestion = () => setQuestions((q) => [...q, defaultQuestion()]);
  const removeQuestion = (id) => setQuestions((q) => q.filter((x) => x.id !== id));
  const updateQuestion = (id, updated) =>
    setQuestions((q) => q.map((x) => (x.id === id ? updated : x)));

  const jsonOutput = JSON.stringify(toJSON(questions), null, 2);

  const copyJSON = () => {
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Form Builder</h1>
        <p>Build form schemas and export as JSON</p>
      </div>

      {/* Builder */}
      <div className="left-panel">
        <div className="panel-title">Questions</div>
        {questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={i}
            questions={questions}
            onChange={(updated) => updateQuestion(q.id, updated)}
            onRemove={() => removeQuestion(q.id)}
          />
        ))}
        <button className="add-btn" onClick={addQuestion}>+ Add Question</button>
      </div>

      {/* JSON output */}
      <div className="right-panel">
        <div className="panel-title json-header">
          <span>JSON Output</span>
          <button className={`copy-btn ${copied ? "copied" : ""}`} onClick={copyJSON}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div className="json-box">{jsonOutput}</div>
      </div>

      {/* Live preview */}
      <FormPreview questions={questions} />
    </div>
  );
}