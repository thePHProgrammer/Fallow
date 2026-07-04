import { useJournal } from '../store/journal'

function download(filename: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function JournalPanel() {
  const { entries, draft, setDraft, saveEntry, removeEntry } = useJournal()

  const exportPlain = () => {
    const text = entries
      .map((e) => {
        const when = new Date(e.createdAt).toLocaleString()
        return [
          `## ${when}`,
          e.feelings && `Feelings: ${e.feelings}`,
          e.thoughts && `Thoughts: ${e.thoughts}`,
          e.gratitude && `Grateful for: ${e.gratitude}`,
        ]
          .filter(Boolean)
          .join('\n')
      })
      .join('\n\n')
    download('fallow-journal.txt', text)
  }

  const canSave =
    draft.feelings.trim() !== '' ||
    draft.thoughts.trim() !== '' ||
    draft.gratitude.trim() !== ''

  return (
    <section className="journal" aria-label="Journal">
      <p className="section-intro">
        Two prompts, no red squiggles, autosaved as you type. This never leaves
        your device.
      </p>

      {/* Spellcheck and autocorrect off on purpose: this is for getting it
          out, not getting it right. */}
      <label className="journal-label" htmlFor="j-feelings">
        How do you feel right now?
      </label>
      <textarea
        id="j-feelings"
        rows={3}
        spellCheck={false}
        autoCorrect="off"
        value={draft.feelings}
        onChange={(e) => setDraft({ feelings: e.target.value })}
      />

      <label className="journal-label" htmlFor="j-thoughts">
        What's on your mind?
      </label>
      <textarea
        id="j-thoughts"
        rows={5}
        spellCheck={false}
        autoCorrect="off"
        value={draft.thoughts}
        onChange={(e) => setDraft({ thoughts: e.target.value })}
      />

      <label className="journal-label" htmlFor="j-gratitude">
        One thing you're grateful for (optional)
      </label>
      <input
        id="j-gratitude"
        type="text"
        spellCheck={false}
        autoCorrect="off"
        value={draft.gratitude}
        onChange={(e) => setDraft({ gratitude: e.target.value })}
      />

      <div className="form-row journal-actions">
        <button className="btn btn-primary" onClick={saveEntry} disabled={!canSave}>
          Keep this entry
        </button>
        {entries.length > 0 && (
          <button className="btn" onClick={exportPlain}>
            Export as plain text
          </button>
        )}
      </div>

      {entries.map((e) => (
        <article className="journal-entry" key={e.id}>
          <header>
            <time>{new Date(e.createdAt).toLocaleString()}</time>
            <button
              className="icon-btn"
              onClick={() => removeEntry(e.id)}
              aria-label="Delete entry"
            >
              ×
            </button>
          </header>
          {e.feelings && <p>{e.feelings}</p>}
          {e.thoughts && <p>{e.thoughts}</p>}
          {e.gratitude && <p className="journal-gratitude">Grateful for: {e.gratitude}</p>}
        </article>
      ))}
    </section>
  )
}
