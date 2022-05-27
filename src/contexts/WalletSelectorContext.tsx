import React, { useCallback, useContext, useEffect, useState } from "react";
import { map, distinctUntilChanged } from "rxjs";
import { setupWalletSelector } from "@near-wallet-selector/core";
import type { WalletSelector, AccountState } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupNearWallet } from "@near-wallet-selector/near-wallet";
import { setupSender } from "@near-wallet-selector/sender";
import { setupMathWallet } from "@near-wallet-selector/math-wallet";
import { setupLedger } from "@near-wallet-selector/ledger";
// @ts-ignore
// import { setupWalletConnect } from "@near-wallet-selector/wallet-connect";
import { CONTRACT_ID } from "../constants";

declare global {
  interface Window {
    selector: WalletSelector;
    modal: WalletSelectorModal;
  }
}

interface WalletSelectorContextValue {
  selector: WalletSelector;
  modal: WalletSelectorModal;
  accounts: Array<AccountState>;
  accountId: string | null;
  setAccountId: (accountId: string) => void;
}

const WalletSelectorContext =
  React.createContext<WalletSelectorContextValue | null>(null);

export const WalletSelectorContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<AccountState>>([]);

  const syncAccountState = (
    currentAccountId: string | null,
    newAccounts: Array<AccountState>
  ) => {
    if (!newAccounts.length) {
      localStorage.removeItem("accountId");
      setAccountId(null);
      setAccounts([]);

      return;
    }

    const validAccountId =
      currentAccountId &&
      newAccounts.some((x) => x.accountId === currentAccountId);
    const newAccountId = validAccountId
      ? currentAccountId
      : newAccounts[0].accountId;

    localStorage.setItem("accountId", newAccountId);
    setAccountId(newAccountId);
    setAccounts(newAccounts);
  };

  const init = useCallback(async () => {
    const _selector = await setupWalletSelector({
      network: "testnet",
      debug: true,
      modules: [
        setupNearWallet(),
        setupSender(),
        setupMathWallet(),
        setupLedger(),
        // setupWalletConnect({
        //   projectId: "c8cb6204543639c31aef44ea4837a554",
        //   metadata: {
        //     name: "NEAR Wallet Selector",
        //     description: "Example dApp used by NEAR Wallet Selector",
        //     url: "wss://relay.walletconnect.com",
        //     icons: ["https://avatars.githubusercontent.com/u/37784886"],
        //   },
        // }),
      ],


    });

    const _modal = setupModal(_selector, { contractId: CONTRACT_ID });
    const state = _selector.store.getState();

    syncAccountState(localStorage.getItem("accountId"), state.accounts);

    window.selector = _selector;
    window.modal = _modal;

    setSelector(_selector);
    setModal(_modal);
  }, []);

  useEffect(() => {
    init().catch((err) => {
      console.error(err);
      alert("Failed to initialise wallet selector");
    });
  }, [init]);

  useEffect(() => {
    if (!selector) {
      return;
    }

    const subscription = selector.store.observable
      .pipe(
        map((state) => state.accounts),
        distinctUntilChanged()
      )
      .subscribe((nextAccounts) => {
        console.log("Accounts Update", nextAccounts);

        syncAccountState(accountId, nextAccounts);
      });

    return () => subscription.unsubscribe();
  }, [selector, accountId]);

  if (!selector || !modal) {
    return null;
  }

  return (
    <WalletSelectorContext.Provider
      value={{
        selector,
        modal,
        accounts,
        accountId,
        setAccountId,
      }}
    >
      {children}
    </WalletSelectorContext.Provider>
  );
};

export function useWalletSelector() {
  const context = useContext(WalletSelectorContext);

  if (!context) {
    throw new Error(
      "useWalletSelector must be used within a WalletSelectorContextProvider"
    );
  }

  return context;
}
