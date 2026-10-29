# Connect Watheq to GitHub (REFAQ-WATHEQ/watheq)

I can't connect GitHub from chat. You do it in Lovable's settings, and GitHub asks you to approve access there. No code changes are needed.

## Check first
The project notes say the code may already sync with a GitHub repository. Open Project settings -> Git and look:
- If a repository is already connected, Lovable can't link a second one. Either keep the current one and rename it on GitHub (step 5), or disconnect it. Disconnecting creates a brand-new repository when you reconnect, and the old one won't sync again.
- If nothing is connected, follow the steps below.

## Steps (desktop)
1. In the editor, click the project name at the top left, then Settings, then Git. You can also use the + next to the chat box, then Project, then GitHub.
2. Click Connect GitHub. GitHub opens and asks you to authorize the Lovable GitHub App. Sign in with an account that is an owner of the REFAQ-WATHEQ account or organization.
3. When GitHub asks where to install the app, choose REFAQ-WATHEQ. Allow all repositories, or only the ones you pick. Then return to Lovable.
4. In Lovable, choose REFAQ-WATHEQ as the account and confirm. Lovable creates a new private repository and pushes the code.
5. Name it "watheq": if Lovable doesn't let you type a name, open the new repository on GitHub, go to Settings -> General -> Repository name, and enter `watheq`. Renaming on GitHub keeps the sync working.

Mobile: chat mode, then + -> Project -> GitHub, then the same steps.

## Notes
- The repository is private. Secrets aren't included. Database migrations don't run automatically through Git.
- Adding a workspace Git connection needs a workspace owner or admin. Pushing needs write access to REFAQ-WATHEQ.
- Docs: https://docs.lovable.dev/integrations/github
- When you're done, send me the repository link and I'll confirm that commits show up there.
