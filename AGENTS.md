# Git workflow

- Check the current branch and `git status` before starting work.
- Fetch and review remote changes before integrating them. Choose a synchronization method that preserves work in progress.
- Commit each feature, fix, or refactor as a logical unit. Use Conventional Commits for commit messages.
- Preserve the user's existing changes and commit history.
- Check staged files for secrets before committing. Keep tokens, passwords, API keys, and local credentials out of Git.
- Report the changes and the corresponding commits when work is complete.
- For every game development update, run the relevant tests, then commit the changes once they pass and push the tested update to GitHub `main` (`origin/main`). The user's standing request authorizes these pushes. Verify the remote branch contains the update before reporting completion.
- Push for other work only when the user explicitly requests it.
- Obtain explicit approval before running a destructive Git command, such as `git push --force` or `git reset --hard`.

# 3D modeling

- Use Blender to create and edit the game's 3D models. Export or convert Blender assets into a format supported by the existing game engine.
