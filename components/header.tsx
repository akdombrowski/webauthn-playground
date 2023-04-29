import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import styles from "./header.module.css";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

// The approach used in this component shows how to build a sign in and sign out
// component that works on pages which support both client and server side
// rendering, and avoids any flash incorrect content on initial page load.
export default function Header() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  return (
    <header>
      <noscript>
        <style>{`.nojs-show { opacity: 1; top: 0; }`}</style>
      </noscript>
      <Container maxWidth="xl">
        <Paper
          elevation={10}
          className={styles.signedInStatus}>
          <Grid
            container
            justifyContent="center"
            className={`nojs-show ${
              !session && loading ? styles.loading : styles.loaded
            }`}>
            {!session && (
              <Grid
                item
                container
                alignContent="center"
                height="5vh">
                <Grid
                  item
                  xxs={1}
                  xs={4}
                  sm={7}
                  md={8}>
                  <Typography
                    variant="h6"
                    sx={{
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}>
                    You are not signed in
                  </Typography>
                </Grid>
                <Grid
                  item
                  container
                  justifyContent="flex-end"
                  xxs={11}
                  xs={8}
                  sm={5}
                  md={4}>
                  <Button
                    variant="contained"
                    size="small"
                    href={`/api/auth/signin`}
                    onClick={(e) => {
                      e.preventDefault();
                      signIn();
                    }}>
                    <Typography variant="subtitle2">Provider Login</Typography>
                  </Button>
                </Grid>
              </Grid>
            )}
            {session?.user && (
              <>
                {session.user.image && (
                  <span
                    style={{ backgroundImage: `url('${session.user.image}')` }}
                    className={styles.avatar}
                  />
                )}
                <span className={styles.signedInText}>
                  <small>Signed in as</small>
                  <br />
                  <strong>{session.user.email ?? session.user.name}</strong>
                </span>
                <a
                  href={`/api/auth/signout`}
                  className={styles.button}
                  onClick={(e) => {
                    e.preventDefault();
                    signOut();
                  }}>
                  Sign out
                </a>
              </>
            )}
          </Grid>
        </Paper>
        <nav>
          <ul className={styles.navItems}>
            <li className={styles.navItem}>
              <Link href="/">Home</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/client">Client</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/server">Server</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/protected">Protected</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/api-example">API</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/admin">Admin</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/me">Me</Link>
            </li>
          </ul>
        </nav>
      </Container>
    </header>
  );
}
