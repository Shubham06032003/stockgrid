# Password Reset Test Cases

## Request Reset

1. Non-existent email
   Expected: `200` with the generic success message and no account enumeration.

2. More than 3 reset requests in one hour from the same IP
   Expected: `429` with a throttling message.

3. More than 3 reset requests in one hour for the same email
   Expected: `429` with a throttling message.

## Reset Password

1. Expired token
   Expected: `400` with `Reset token is invalid or has expired.`

2. Invalid token
   Expected: `400` with `Reset token is invalid or has expired.`

3. Reused token
   Expected: first request succeeds, second request returns `400` because the token was deleted after first use.

4. Reset with the same password
   Expected: `400` with `Choose a password you have not used recently.`

5. Successful reset
   Expected: `200`, password hash updated, and all outstanding reset tokens for that user removed.
