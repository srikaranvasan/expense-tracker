import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/domain/users/entities";
import type {
  PersonBalanceView,
  PersonDetailView,
  PersonView,
} from "@/features/people/view-models/person-view-model";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId, fixedDate } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedSettlement,
  seedSharedExpense,
  splitForPerson,
  splitForUser,
} from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listPeople, POST: createPerson } = await import("@/app/api/people/route");
const {
  GET: getPerson,
  PATCH: patchPerson,
  DELETE: archivePerson,
} = await import("@/app/api/people/[id]/route");
const { POST: restorePerson } = await import("@/app/api/people/[id]/restore/route");
const { GET: getBalance } = await import("@/app/api/people/[id]/balance/route");

let user: User;

async function postPerson(name = "Arun", notes?: string) {
  return invokeRoute<PersonView>(createPerson, "/api/people", {
    method: "POST",
    body: { clientId: clientId("person"), name, ...(notes ? { notes } : {}) },
  });
}

async function fetchPerson(personId: string) {
  return invokeRoute<PersonDetailView>(getPerson, `/api/people/${personId}`, {
    params: { id: personId },
  });
}

async function fetchBalance(personId: string) {
  return invokeRoute<PersonBalanceView & { personId: string }>(
    getBalance,
    `/api/people/${personId}/balance`,
    { params: { id: personId } },
  );
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
});

describe("POST /api/people", () => {
  it("adds a person with a settled starting balance", async () => {
    const response = await postPerson("Arun");

    expect(response.status).toBe(201);
    const person = expectData(response);
    expect(person.name).toBe("Arun");
    expect(person.initials).toBe("A");
    expect(person.balance.isSettled).toBe(true);
    expect(person.balance.direction).toBe("settled");
    expect(person.balance.net.amount).toBe("0");
  });

  it("stores optional notes", async () => {
    const person = expectData(await postPerson("Vijay", "Flatmate"));
    expect(person.notes).toBe("Flatmate");
  });

  it("collapses surrounding and repeated whitespace in the name", async () => {
    const person = expectData(
      await invokeRoute<PersonView>(createPerson, "/api/people", {
        method: "POST",
        body: { clientId: clientId("person"), name: "  Arun    Kumar  " },
      }),
    );

    expect(person.name).toBe("Arun Kumar");
    expect(person.initials).toBe("AK");
  });

  it("rejects an empty name", async () => {
    const response = await invokeRoute(createPerson, "/api/people", {
      method: "POST",
      body: { clientId: clientId("person"), name: "   " },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid clientId", async () => {
    const response = await invokeRoute(createPerson, "/api/people", {
      method: "POST",
      body: { clientId: "nope", name: "Arun" },
    });

    expect(response.status).toBe(400);
  });

  it("is idempotent for a repeated clientId", async () => {
    const id = clientId("person");

    const first = expectData(
      await invokeRoute<PersonView>(createPerson, "/api/people", {
        method: "POST",
        body: { clientId: id, name: "Arun" },
      }),
    );
    const second = expectData(
      await invokeRoute<PersonView>(createPerson, "/api/people", {
        method: "POST",
        body: { clientId: id, name: "Retry name" },
      }),
    );

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Arun");
  });

  it("allows two people with the same name", async () => {
    const first = expectData(await postPerson("Arun"));
    const second = expectData(await postPerson("Arun"));

    expect(second.id).not.toBe(first.id);
  });

  it("requires authentication", async () => {
    setCurrentTestUser(null);
    expect((await postPerson()).status).toBe(401);
  });
});

describe("GET /api/people", () => {
  it("lists people with their balances", async () => {
    await postPerson("Arun");
    await postPerson("Vijay");

    const { items } = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people"),
    );

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.name).sort()).toEqual(["Arun", "Vijay"]);
  });

  it("filters by name", async () => {
    await postPerson("Arun");
    await postPerson("Vijay");

    const { items } = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people", {
        searchParams: { search: "vij" },
      }),
    );

    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe("Vijay");
  });

  it("treats a regex metacharacter in the search term as a literal", async () => {
    await postPerson("Arun");

    // Unescaped, ".*" would match everything.
    const { items } = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people", {
        searchParams: { search: ".*" },
      }),
    );

    expect(items).toHaveLength(0);
  });

  it("excludes archived people unless asked", async () => {
    const person = expectData(await postPerson("Vijay"));
    await invokeRoute(archivePerson, `/api/people/${person.id}`, {
      method: "DELETE",
      params: { id: person.id },
    });

    const active = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people"),
    );
    expect(active.items).toHaveLength(0);

    const all = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people", {
        searchParams: { includeArchived: "true" },
      }),
    );
    expect(all.items).toHaveLength(1);
    expect(all.items[0]?.isArchived).toBe(true);
  });

  it("does not return another user's people", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    await postPerson("Theirs");

    setCurrentTestUser(user);
    const { items } = expectData(
      await invokeRoute<{ items: PersonView[] }>(listPeople, "/api/people"),
    );
    expect(items).toHaveLength(0);
  });
});

describe("person balance", () => {
  it("reports what a person owes after the user pays for the group", async () => {
    const arun = expectData(await postPerson("Arun"));
    const vijay = expectData(await postPerson("Vijay"));
    const account = await seedBankAccount(user.id);

    // ₹1,200 dinner paid by the user, split three ways.
    await seedSharedExpense(user.id, {
      amount: "1200",
      description: "Dinner",
      accountId: account.id,
      participants: [
        { personId: null, share: "400" },
        { personId: arun.id, share: "400" },
        { personId: vijay.id, share: "400" },
      ],
    });

    const balance = expectData(await fetchBalance(arun.id));

    expect(balance.direction).toBe("person_owes_user");
    expect(balance.personOwesUser.amount).toBe("400");
    expect(balance.userOwesPerson.amount).toBe("0");
    expect(balance.netAbsolute.amount).toBe("400");
    expect(balance.label).toBe("owes you");
    expect(balance.isSettled).toBe(false);
  });

  it("reports what the user owes when someone else pays", async () => {
    const arun = expectData(await postPerson("Arun"));

    // Arun paid ₹900, so no account of the user's was charged.
    await seedSharedExpense(user.id, {
      amount: "900",
      description: "Groceries",
      paidByPersonId: arun.id,
      accountId: null,
      participants: [
        { personId: null, share: "450" },
        { personId: arun.id, share: "450" },
      ],
    });

    const balance = expectData(await fetchBalance(arun.id));

    expect(balance.direction).toBe("user_owes_person");
    expect(balance.userOwesPerson.amount).toBe("450");
    expect(balance.personOwesUser.amount).toBe("0");
    expect(balance.label).toBe("you owe");
  });

  it("nets obligations that run in both directions", async () => {
    const arun = expectData(await postPerson("Arun"));

    await seedSharedExpense(user.id, {
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });
    await seedSharedExpense(user.id, {
      amount: "400",
      paidByPersonId: arun.id,
      participants: [
        { personId: null, share: "200" },
        { personId: arun.id, share: "200" },
      ],
    });

    const balance = expectData(await fetchBalance(arun.id));

    expect(balance.personOwesUser.amount).toBe("500");
    expect(balance.userOwesPerson.amount).toBe("200");
    expect(balance.net.amount).toBe("300");
    expect(balance.direction).toBe("person_owes_user");
  });

  it("ignores an obligation between two other people", async () => {
    const arun = expectData(await postPerson("Arun"));
    const vijay = expectData(await postPerson("Vijay"));

    // Arun paid and Vijay consumed. That is between them, not the user.
    await seedSharedExpense(user.id, {
      amount: "600",
      paidByPersonId: arun.id,
      participants: [{ personId: vijay.id, share: "600" }],
    });

    expect(expectData(await fetchBalance(arun.id)).isSettled).toBe(true);
    expect(expectData(await fetchBalance(vijay.id)).isSettled).toBe(true);
  });

  it("reduces the balance by a settlement allocation", async () => {
    const arun = expectData(await postPerson("Arun"));
    const account = await seedBankAccount(user.id);

    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: account.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "300" }],
    });

    const balance = expectData(await fetchBalance(arun.id));
    expect(balance.personOwesUser.amount).toBe("200");
    expect(balance.isSettled).toBe(false);
  });

  it("becomes settled once every obligation is fully allocated", async () => {
    const arun = expectData(await postPerson("Arun"));

    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "500",
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "500" }],
    });

    const balance = expectData(await fetchBalance(arun.id));
    expect(balance.isSettled).toBe(true);
    expect(balance.direction).toBe("settled");
    expect(balance.unsettledCount).toBe(0);
  });

  it("keeps an uneven three-way split exact", async () => {
    const arun = expectData(await postPerson("Arun"));
    const vijay = expectData(await postPerson("Vijay"));

    // ₹1,000 across three people: 333.34 / 333.33 / 333.33.
    await seedSharedExpense(user.id, {
      amount: "1000",
      participants: [
        { personId: null, share: "333.34" },
        { personId: arun.id, share: "333.33" },
        { personId: vijay.id, share: "333.33" },
      ],
    });

    expect(expectData(await fetchBalance(arun.id)).net.amount).toBe("333.33");
    expect(expectData(await fetchBalance(vijay.id)).net.amount).toBe("333.33");
  });

  it("excludes a deleted expense from the balance", async () => {
    const arun = expectData(await postPerson("Arun"));
    const { transactionRepository } =
      await import("@/server/repositories/mongo/transaction-repository");

    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    expect(expectData(await fetchBalance(arun.id)).net.amount).toBe("500");

    await transactionRepository().softDelete(user.id, expense.transaction.id);

    expect(expectData(await fetchBalance(arun.id)).isSettled).toBe(true);
  });

  it("does not expose another user's person balance", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postPerson("Theirs"));

    setCurrentTestUser(user);
    const response = await fetchBalance(theirs.id);

    expect(response.status).toBe(404);
    expect(expectError(response).code).toBe("NOT_FOUND");
  });
});

describe("GET /api/people/:id", () => {
  it("returns the expenses and settlements behind the balance", async () => {
    const arun = expectData(await postPerson("Arun"));
    const account = await seedBankAccount(user.id);

    const dinner = await seedSharedExpense(user.id, {
      amount: "1000",
      description: "Dinner",
      accountId: account.id,
      date: fixedDate("2026-08-10T12:00:00.000Z"),
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });
    await seedSharedExpense(user.id, {
      amount: "600",
      description: "Movie",
      accountId: account.id,
      date: fixedDate("2026-08-20T12:00:00.000Z"),
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "300" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "300",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForPerson(dinner, arun.id).id, amount: "300" }],
    });

    const person = expectData(await fetchPerson(arun.id));

    // Newest first.
    expect(person.obligations.map((o) => o.description)).toEqual(["Movie", "Dinner"]);

    const movie = person.obligations.find((o) => o.description === "Movie");
    expect(movie?.status).toBe("unsettled");
    expect(movie?.remainingAmount.amount).toBe("300");

    const dinnerView = person.obligations.find((o) => o.description === "Dinner");
    expect(dinnerView?.status).toBe("partially_settled");
    expect(dinnerView?.allocatedAmount.amount).toBe("300");
    expect(dinnerView?.remainingAmount.amount).toBe("200");

    expect(person.settlements).toHaveLength(1);
    expect(person.settlements[0]?.directionLabel).toBe("They paid you");
    expect(person.balance.net.amount).toBe("500");
  });

  it("only includes obligations for the requested person", async () => {
    const arun = expectData(await postPerson("Arun"));
    const vijay = expectData(await postPerson("Vijay"));

    await seedSharedExpense(user.id, {
      amount: "900",
      participants: [
        { personId: null, share: "300" },
        { personId: arun.id, share: "300" },
        { personId: vijay.id, share: "300" },
      ],
    });

    const person = expectData(await fetchPerson(arun.id));
    expect(person.obligations).toHaveLength(1);
    expect(person.obligations[0]?.expenseSplitId).toBeDefined();
  });

  it("labels the direction on each obligation", async () => {
    const arun = expectData(await postPerson("Arun"));

    await seedSharedExpense(user.id, {
      amount: "200",
      description: "You paid",
      participants: [
        { personId: null, share: "100" },
        { personId: arun.id, share: "100" },
      ],
    });
    await seedSharedExpense(user.id, {
      amount: "400",
      description: "Arun paid",
      paidByPersonId: arun.id,
      participants: [
        { personId: null, share: "200" },
        { personId: arun.id, share: "200" },
      ],
    });

    const person = expectData(await fetchPerson(arun.id));

    expect(person.obligations.find((o) => o.description === "You paid")?.directionLabel).toBe(
      "Owes you",
    );
    expect(person.obligations.find((o) => o.description === "Arun paid")?.directionLabel).toBe(
      "You owe",
    );
  });

  it("returns 404 for another user's person", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postPerson("Theirs"));

    setCurrentTestUser(user);
    expect((await fetchPerson(theirs.id)).status).toBe(404);
  });
});

describe("PATCH /api/people/:id", () => {
  it("updates the name and notes", async () => {
    const person = expectData(await postPerson("Arun"));

    const updated = expectData(
      await invokeRoute<PersonView>(patchPerson, `/api/people/${person.id}`, {
        method: "PATCH",
        params: { id: person.id },
        body: { name: "Arun Kumar", notes: "Flatmate" },
      }),
    );

    expect(updated.name).toBe("Arun Kumar");
    expect(updated.notes).toBe("Flatmate");
    expect(updated.syncVersion).toBe(person.syncVersion + 1);
  });

  it("clears notes when sent as null", async () => {
    const person = expectData(await postPerson("Arun", "Flatmate"));

    const updated = expectData(
      await invokeRoute<PersonView>(patchPerson, `/api/people/${person.id}`, {
        method: "PATCH",
        params: { id: person.id },
        body: { notes: null },
      }),
    );

    expect(updated.notes).toBeNull();
  });

  it("rejects an empty update", async () => {
    const person = expectData(await postPerson("Arun"));

    const response = await invokeRoute(patchPerson, `/api/people/${person.id}`, {
      method: "PATCH",
      params: { id: person.id },
      body: {},
    });

    expect(response.status).toBe(400);
  });

  it("rejects a stale sync version", async () => {
    const person = expectData(await postPerson("Arun"));

    await invokeRoute(patchPerson, `/api/people/${person.id}`, {
      method: "PATCH",
      params: { id: person.id },
      body: { name: "First edit" },
    });

    const stale = await invokeRoute(patchPerson, `/api/people/${person.id}`, {
      method: "PATCH",
      params: { id: person.id },
      body: { name: "Second edit", expectedSyncVersion: person.syncVersion },
    });

    expect(stale.status).toBe(409);
    expect(expectError(stale).code).toBe("CONFLICT");
  });

  it("does not update another user's person", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postPerson("Theirs"));

    setCurrentTestUser(user);
    const response = await invokeRoute(patchPerson, `/api/people/${theirs.id}`, {
      method: "PATCH",
      params: { id: theirs.id },
      body: { name: "Mine now" },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/people/:id", () => {
  it("archives the person and keeps their history and balance", async () => {
    const arun = expectData(await postPerson("Arun"));

    await seedSharedExpense(user.id, {
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    const archived = expectData(
      await invokeRoute<PersonView>(archivePerson, `/api/people/${arun.id}`, {
        method: "DELETE",
        params: { id: arun.id },
      }),
    );

    expect(archived.isArchived).toBe(true);

    // Archiving must not silently write off what they owe.
    const detail = expectData(await fetchPerson(arun.id));
    expect(detail.balance.net.amount).toBe("500");
    expect(detail.obligations).toHaveLength(1);
  });

  it("is safe to call twice", async () => {
    const person = expectData(await postPerson("Arun"));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await invokeRoute<PersonView>(archivePerson, `/api/people/${person.id}`, {
        method: "DELETE",
        params: { id: person.id },
      });
      expect(response.status).toBe(200);
      expect(expectData(response).isArchived).toBe(true);
    }
  });

  it("restores an archived person", async () => {
    const person = expectData(await postPerson("Arun"));
    await invokeRoute(archivePerson, `/api/people/${person.id}`, {
      method: "DELETE",
      params: { id: person.id },
    });

    const restored = expectData(
      await invokeRoute<PersonView>(restorePerson, `/api/people/${person.id}/restore`, {
        method: "POST",
        params: { id: person.id },
      }),
    );

    expect(restored.isArchived).toBe(false);
  });

  it("does not archive another user's person", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postPerson("Theirs"));

    setCurrentTestUser(user);
    const response = await invokeRoute(archivePerson, `/api/people/${theirs.id}`, {
      method: "DELETE",
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("settlement effect on account balance", () => {
  it("reduces the paying account when the user settles up", async () => {
    const arun = expectData(await postPerson("Arun"));
    const account = await seedBankAccount(user.id, { openingBalance: "50000" });

    const expense = await seedSharedExpense(user.id, {
      amount: "900",
      paidByPersonId: arun.id,
      participants: [
        { personId: null, share: "450" },
        { personId: arun.id, share: "450" },
      ],
    });

    await seedSettlement(user.id, {
      personId: arun.id,
      direction: "user_to_person",
      amount: "450",
      accountId: account.id,
      allocations: [{ expenseSplitId: splitForUser(expense).id, amount: "450" }],
    });

    const { GET: getAccount } = await import("@/app/api/accounts/[id]/route");
    const view = expectData(
      await invokeRoute<{ balance: { amount: string } }>(
        getAccount,
        `/api/accounts/${account.id}`,
        { params: { id: account.id } },
      ),
    );

    // The expense itself charged no account of the user's; only the settlement did.
    expect(view.balance.amount).toBe("49550");
    expect(expectData(await fetchBalance(arun.id)).isSettled).toBe(true);
  });
});
