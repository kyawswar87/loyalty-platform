@AGENTS.md

# Development workflow

Follow these steps for every change:

1. **Create a GitHub issue** describing the change before implementing.
2. **Pull `main` and branch off it** — `git pull origin main`, then create a new
   branch for the work.
3. **Version the database** — if the change touches the schema, generate a new
   migration (`npm run db:generate`); never edit an existing migration.
4. **Write unit tests** covering the change.
5. **Commit** the changes with descriptive commit messages.
6. **Open a PR** and close the related issue (e.g. `Closes #<issue>`).
7. **Update `README.md`** to reflect the change.
