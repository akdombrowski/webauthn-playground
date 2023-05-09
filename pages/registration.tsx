import {
  useState,
  SyntheticEvent,
  useMemo,
  useEffect,
  useRef,
  ForwardedRef,
  MutableRefObject,
} from "react";

import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";

import { signIn, signOut, useSession } from "next-auth/react";

import { GetServerSideProps } from "next";
import NextLinkComposed from "../components/NextLinkComposed";

import { getXataClient } from "../db/xata";
import { useFormControl } from "@mui/material/FormControl";
import { FormControl, InputLabel, OutlinedInput } from "@mui/material";
import EmailInput from "../components/EmailInput";

import { convertStringToUint8Array } from "../util";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const xata = getXataClient();
  const { randomFillSync } = await import("node:crypto");

  const rpName = process.env.RP_NAME;
  const rpID = process.env.RP_ID;
  const DEBUG = process.env.DEBUG;

  if (DEBUG) {
    console.log("CAUTION: IN DEBUG MODE");
  }

  return {
    props: {
      rpName,
      rpID,
      DEBUG,
    },
  };
};

const login = ({
  rpName,
  rpID,
  DEBUG,
}: {
  rpName: string;
  rpID: string;
  DEBUG: boolean;
}) => {
  const { data: session, status } = useSession();
  const [savedCred, setSavedCred] = useState(false);
  const ref = useRef<HTMLInputElement | null>(null);
  let challengeUint8: Uint8Array;
  let userID: Uint8Array;

  if (DEBUG) {
    console.log("CAUTION: IN DEBUG MODE");
  }

  const isWebAuthnAvail = () => {
    if (DEBUG) {
      console.log("");
      console.log("ref");
      console.log(ref);
    }
    if (ref && ref.current) {
      const cur = ref.current as unknown as HTMLElement;
      if (DEBUG) {
        console.log("");
        console.log("cur");
        console.log(cur);
      }
      // cur.focus();
    }
    return window.PublicKeyCredential;
  };

  const createPubKey = async (
    userIDStr: string,
    email: string
  ): Promise<PublicKeyCredential | null> => {
    const userIDUI8Arr = convertStringToUint8Array(userIDStr, "", 10);

    if (!userIDUI8Arr) {
      throw new Error(
        "Didn't get a userID or one that could be converted to a Uint8Array"
      );
    }

    if (!challengeUint8) {
      throw new Error("Missing challenge");
    }

    const pubKeyOpt: PublicKeyCredentialCreationOptions = {
      // The challenge is produced by the server; see the Security Considerations
      challenge: challengeUint8,

      // Relying Party:
      rp: {
        name: rpName,
      },

      // User:
      user: {
        id: userIDUI8Arr,
        name: email,
        displayName: email,
      },

      // This Relying Party will accept either an ES256 or RS256 credential, but
      // prefers an RS256 credential.
      pubKeyCredParams: [
        {
          type: "public-key",
          alg: -257, // Value registered by this specification for "RS256"
        } as PublicKeyCredentialParameters,
      ],

      authenticatorSelection: {
        // UV required.
        userVerification: "required" as UserVerificationRequirement,
      },

      timeout: 300000, // 5 minutes
      excludeCredentials: [
        // Don’t re-register any authenticator that has one of these credentials
      ],

      // Make excludeCredentials check backwards compatible with credentials registered with U2F
      extensions: {},
    };

    try {
      const pubKeyCred = await createCred(pubKeyOpt);
      return pubKeyCred as PublicKeyCredential;
    } catch (e: any) {
      console.error("failed to create webauthn cred");
      console.error(e.message);
      return null;
    }
  };

  const createCred = async (pubKeyOpt: PublicKeyCredentialCreationOptions) => {
    // Note: The following call will cause the authenticator to display UI.
    return navigator.credentials.create({ publicKey: pubKeyOpt });
  };

  // Handles the submit event on form submit.
  const handleSubmit = async (event: SyntheticEvent) => {
    // Stop the form from submitting and refreshing the page.
    event.preventDefault();

    let data;
    let endpoint;
    let pubKeyCred;
    const target = event.target as HTMLFormElement;

    try {
      if (!isWebAuthnAvail) {
        throw new Error("WebAuthn isn't available on this browser/client.");
      }
      pubKeyCred = await createPubKey(userID.toString(), target.email.value);
    } catch (e) {
      const err = e as Error;
      console.error("WebAuthn failed:", err.message);
    }

    if (pubKeyCred) {
      const { authenticatorAttachment, id, rawId, response, type } = pubKeyCred;
      const rawIdArr = new Uint8Array(rawId);
      const rawIdStr = rawIdArr.toString();
      const res = response as AuthenticatorAttestationResponse;
      const attestationObjectArr = new Uint8Array(res.attestationObject);
      const attestationObjectStr = attestationObjectArr.toString();
      const clientDataJSONArr = new Uint8Array(res.clientDataJSON);
      const clientDataJSONStr = clientDataJSONArr.toString();
      const challStr = challengeUint8.toString();

      // Prep data object for sending to api
      data = {
        email: target.email.value,
        pubKeyCred: {
          authenticatorAttachment,
          id,
          rawId: rawIdStr,
          response: {
            attestationObj: attestationObjectStr,
            clientDataJSON: clientDataJSONStr,
          },
          type: type,
        },
        challenge: challStr,
      };

      // API endpoint where we send form data.
      endpoint = "/api/webauthn";
    } else {
      console.error("No credential entered");
      return;
    }

    // Send the data to the server in JSON format.
    let jsonData = JSON.stringify(data);
    // Form the request for sending data to the server.
    const options = {
      // The method is POST because we are sending data.
      method: "POST",
      // Tell the server we're sending JSON.
      headers: {
        "Content-Type": "application/json",
      },
      // Body of the request is the JSON data we created above.
      body: jsonData,
    };

    // Send the form data to our forms API on Vercel and get a response.
    const response = await fetch(endpoint, options);

    if (DEBUG) {
      console.log("response");
      console.log(response);
    }

    // Get the response data from server as JSON.
    // If server returns the name submitted, that means the form works.
    const result = await response.json();

    signIn("webauthn", { result: JSON.stringify(result) });
  };

  return (
    <Grid
      container
      py={5}
      px={3}>
      {savedCred || session ? (
        <Grid
          item
          container
          xs={12}>
          <Grid
            item
            xs={12}>
            <Typography>"You're signed in"</Typography>
          </Grid>
          <Grid
            item
            xs={12}>
            <Button
              component={NextLinkComposed}
              to={{ pathname: "/protected" }}
              variant="contained"
            />
          </Grid>
        </Grid>
      ) : (
        <Grid
          item
          container
          xs={12}>
          <Grid
            item
            container
            xs={12}
            justifyContent="center">
            <Box
              sx={{
                marginTop: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}>
              <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}>
                <LockOutlinedIcon />
              </Avatar>
              <Typography
                component="h1"
                variant="h5">
                Register A New Account
              </Typography>
              <Box
                component="form"
                onSubmit={handleSubmit}
                noValidate
                autoComplete="off"
                sx={{ mt: 1 }}>
                <FormControl sx={{ width: "100%" }}>
                  <InputLabel htmlFor="email">Email</InputLabel>
                  <EmailInput />
                </FormControl>
                {/* <FormControlLabel
                  control={
                    <Checkbox
                      value="remember"
                      color="primary"
                      />
                  }
                  label="Remember me"
                /> */}
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{ mt: 3, mb: 2 }}>
                  Sign Up
                </Button>
                <Grid container>
                  <Grid item>
                    <Link
                      href="/login"
                      variant="body2">
                      {"Already have an account? Sign In"}
                    </Link>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Grid>
        </Grid>
      )}
    </Grid>
  );
};

export default login;
