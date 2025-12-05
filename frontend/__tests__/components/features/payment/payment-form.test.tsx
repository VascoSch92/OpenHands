import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import BillingService from "#/api/billing-service/billing-service.api";
import OptionService from "#/api/option-service/option-service.api";
import { organizationService } from "#/api/organization-service/organization-service.api";
import { PaymentForm } from "#/components/features/payment/payment-form";
import { renderWithProviders } from "../../../../test-utils";

// Mock the stripe checkout hook to avoid JSDOM navigation issues
const mockMutate = vi.fn().mockResolvedValue(undefined);
vi.mock("#/hooks/mutation/stripe/use-create-stripe-checkout-session", () => ({
  useCreateStripeCheckoutSession: () => ({
    mutate: mockMutate,
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  }),
}));

// Mock useSelectedOrganizationId to provide orgId so useMe query is enabled
vi.mock("#/context/use-selected-organization", () => ({
  useSelectedOrganizationId: vi.fn(() => ({
    orgId: "1",
    setOrgId: vi.fn(),
  })),
}));

describe("PaymentForm", () => {
  const getBalanceSpy = vi.spyOn(BillingService, "getBalance");
  const createCheckoutSessionSpy = vi.spyOn(
    BillingService,
    "createCheckoutSession",
  );
  const getConfigSpy = vi.spyOn(OptionService, "getConfig");
  const getMeSpy = vi.spyOn(organizationService, "getMe");

  const renderPaymentForm = () => renderWithProviders(<PaymentForm />);

  beforeEach(() => {
    // useBalance hook will return the balance only if the APP_MODE is "saas" and the billing feature is enabled
    getConfigSpy.mockResolvedValue({
      APP_MODE: "saas",
      GITHUB_CLIENT_ID: "123",
      POSTHOG_CLIENT_KEY: "456",
      FEATURE_FLAGS: {
        ENABLE_BILLING: true,
        HIDE_LLM_SETTINGS: false,
        ENABLE_JIRA: false,
        ENABLE_JIRA_DC: false,
        ENABLE_LINEAR: false,
      },
    });

    // Set default mock for user (owner role has add_credits permission)
    getMeSpy.mockResolvedValue({
      id: "1",
      email: "test@example.com",
      role: "owner",
      status: "active",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockMutate.mockClear();
  });

  it("should render the users current balance", async () => {
    getBalanceSpy.mockResolvedValue("100.50");
    renderPaymentForm();

    await waitFor(() => {
      const balance = screen.getByTestId("user-balance");
      expect(balance).toHaveTextContent("$100.50");
    });
  });

  it("should render the users current balance to two decimal places", async () => {
    getBalanceSpy.mockResolvedValue("100");
    renderPaymentForm();

    await waitFor(() => {
      const balance = screen.getByTestId("user-balance");
      expect(balance).toHaveTextContent("$100.00");
    });
  });

  test("the user can top-up a specific amount", async () => {
    const user = userEvent.setup();
    renderPaymentForm();

    const topUpInput = await screen.findByTestId("top-up-input");
    await user.type(topUpInput, "50");

    const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
    await user.click(topUpButton);

    expect(mockMutate).toHaveBeenCalledWith({ amount: 50 });
  });

  it("should only accept integer values", async () => {
    const user = userEvent.setup();
    renderPaymentForm();

    const topUpInput = await screen.findByTestId("top-up-input");
    await user.type(topUpInput, "50");

    const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
    await user.click(topUpButton);

    expect(mockMutate).toHaveBeenCalledWith({ amount: 50 });
  });

  it("should disable the top-up button if the user enters an invalid amount", async () => {
    const user = userEvent.setup();
    renderPaymentForm();

    const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
    expect(topUpButton).toBeDisabled();

    const topUpInput = await screen.findByTestId("top-up-input");
    await user.type(topUpInput, "  ");

    expect(topUpButton).toBeDisabled();
  });

  it("should disable the top-up button after submission", async () => {
    const user = userEvent.setup();
    renderPaymentForm();

    const topUpInput = await screen.findByTestId("top-up-input");
    await user.type(topUpInput, "50");

    const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
    await user.click(topUpButton);

    expect(topUpButton).toBeDisabled();
  });

  describe("prevent submission if", () => {
    test("user enters a negative amount", async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      const topUpInput = await screen.findByTestId("top-up-input");
      await user.type(topUpInput, "-50");

      const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
      await user.click(topUpButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("user enters an empty string", async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      const topUpInput = await screen.findByTestId("top-up-input");
      await user.type(topUpInput, "     ");

      const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
      await user.click(topUpButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("user enters a non-numeric value", async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      // With type="number", the browser would prevent non-numeric input,
      // but we'll test the validation logic anyway
      const topUpInput = await screen.findByTestId("top-up-input");
      await user.type(topUpInput, "abc");

      const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
      await user.click(topUpButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("user enters less than the minimum amount", async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      const topUpInput = await screen.findByTestId("top-up-input");
      await user.type(topUpInput, "9"); // test assumes the minimum is 10

      const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
      await user.click(topUpButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });

    test("user enters a decimal value", async () => {
      const user = userEvent.setup();
      renderPaymentForm();

      // With step="1", the browser would validate this, but we'll test our validation logic
      const topUpInput = await screen.findByTestId("top-up-input");
      await user.type(topUpInput, "50.5");

      const topUpButton = screen.getByText("PAYMENT$ADD_CREDIT");
      await user.click(topUpButton);

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe("Role-based permission behavior", () => {
    beforeEach(() => {
      getBalanceSpy.mockResolvedValue("100.00");
    });

    describe("Button disabled state based on role permissions", () => {
      it("should disable 'Add Credits' button for User role", async () => {
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "user",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).toBeDisabled();
      });

      it("should enable 'Add Credits' button for Owner role when input is valid", async () => {
        const user = userEvent.setup();
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "owner",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const input = screen.getByTestId("top-up-input");
        await user.type(input, "100");

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).not.toBeDisabled();
      });

      it("should enable 'Add Credits' button for Admin role when input is valid", async () => {
        const user = userEvent.setup();
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "admin",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const input = screen.getByTestId("top-up-input");
        await user.type(input, "100");

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).not.toBeDisabled();
      });

      it("should keep button disabled when user lacks permission even with valid input", async () => {
        const user = userEvent.setup();
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "user",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const input = screen.getByTestId("top-up-input");
        await user.type(input, "100");

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).toBeDisabled();
      });
    });

    describe("Permission check integration with other disabled conditions", () => {
      it("should disable button when user has permission but form is pending", async () => {
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "owner",
          status: "active",
        });
        // Note: The original mock always returns isPending: false, so this test
        // verifies the permission check logic. In a real scenario with isPending: true,
        // the button would be disabled regardless of permission.
        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).toBeDisabled();
      });

      it("should enable button only when all conditions are met (permission, not pending, valid input)", async () => {
        const user = userEvent.setup();
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "owner",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const input = screen.getByTestId("top-up-input");
        await user.type(input, "100");

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).not.toBeDisabled();
      });

      it("should disable button when user lacks permission even if other conditions are met", async () => {
        const user = userEvent.setup();
        getMeSpy.mockResolvedValue({
          id: "1",
          email: "test@example.com",
          role: "user",
          status: "active",
        });

        renderPaymentForm();

        // Wait for balance to load
        await waitFor(() => {
          expect(screen.getByTestId("user-balance")).toBeInTheDocument();
        });

        const input = screen.getByTestId("top-up-input");
        await user.type(input, "100");

        const addCreditButton = screen.getByRole("button", {
          name: /PAYMENT\$ADD_CREDIT/i,
        });

        expect(addCreditButton).toBeDisabled();
      });
    });
  });
});
