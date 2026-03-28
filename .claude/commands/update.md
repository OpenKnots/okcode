Run the following command:

```
git fetch origin && git rebase origin/${branch}
```

Where `${branch}` is the current git branch (run `git branch --show-current` to determine it).

Report the result to the user.
