import { useState, type FormEvent } from "react";
import { ASK_EXAMPLES, askTwin, type TwinAnswer } from "../ask";
import type { CrewId, Plant, WhatIfLevers } from "../types";
import { Detail } from "./Detail";

// Detail G. Ask the twin a question. Rule-based, not an AI model: every
// answer comes from a run of the simulator and says which run.
export function AskTwin({
  plant,
  seed,
  levers,
  crew,
}: {
  plant: Plant;
  seed: Plant;
  levers: WhatIfLevers;
  crew: CrewId;
}) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState<TwinAnswer | null>(null);

  const ask = (text: string) => {
    setQuestion(text);
    setAsked(text);
    setAnswer(askTwin(text, seed, levers, crew));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const second = plant.stations[1] ?? plant.stations[0];
  const last = plant.stations[plant.stations.length - 1];
  const examples = ASK_EXAMPLES.map((text) =>
    text.replace("{second}", second.name.toLowerCase()).replace("{last}", last.name.toLowerCase()),
  );

  return (
    <Detail
      letter="G"
      title="Ask the twin"
      note="rule-based, not an AI model: every answer is a run of the simulator"
      span="full"
    >
      <form className="ask-form" onSubmit={submit}>
        <label className="cell-label" htmlFor="ask-input">
          YOUR QUESTION
        </label>
        <div className="ask-row">
          <input
            id="ask-input"
            type="text"
            value={question}
            maxLength={160}
            placeholder={examples[1]}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" className="crew-btn active">
            Run it
          </button>
        </div>
      </form>
      <div className="ask-examples" role="group" aria-label="Example questions">
        {examples.map((text) => (
          <button key={text} type="button" className="crew-btn" onClick={() => ask(text)}>
            {text}
          </button>
        ))}
      </div>
      {answer && (
        <div className={answer.understood ? "ask-answer" : "ask-answer ask-answer-bad"} role="status">
          <span className="cell-label">{asked.toUpperCase()}</span>
          <b>{answer.title}</b>
          <ul>
            {answer.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="fine">
            {answer.run}
            {answer.change && " The levers on the right were not changed."}
          </p>
        </div>
      )}
    </Detail>
  );
}
