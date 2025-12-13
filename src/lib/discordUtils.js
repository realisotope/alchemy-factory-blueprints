/**
 * Remove Discord discriminator (e.g., #0, #1234) from username
 * Discord changed their username system, so usernames may have #0 appended
 * @param {string} username - The username possibly containing a discriminator
 * @returns {string} - The username without the discriminator
 */
export function stripDiscordDiscriminator(username) {
  if (!username) return username;
  // Remove #numbers from the end of the username
  return username.replace(/#\d+$/, '');
}
