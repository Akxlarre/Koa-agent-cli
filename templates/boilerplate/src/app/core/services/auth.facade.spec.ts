import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { vi } from "vitest";
import type { User } from "@core/models/user.model";
import { AuthFacade } from "./auth.facade";
import { SupabaseService } from "./supabase.service";

describe("AuthFacade", () => {
  let service: AuthFacade;
  let router: Router;
  let supabaseSpy: {
    getUser: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    resetPasswordForEmail: ReturnType<typeof vi.fn>;
    client: unknown;
  };

  beforeEach(() => {
    const mockSupabaseClient = {
      auth: {
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    };

    supabaseSpy = {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signIn: vi.fn().mockResolvedValue({ error: null }),
      signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      client: mockSupabaseClient,
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseSpy },
      ],
    });

    service = TestBed.inject(AuthFacade);
    router = TestBed.inject(Router);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("currentUser should start as null", () => {
    expect(service.currentUser()).toBeNull();
  });

  it("isAuthenticated should be false when no user is set", () => {
    expect(service.isAuthenticated()).toBe(false);
  });

  it("setUser() should update currentUser signal", () => {
    const user: User = {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "member",
      initials: "TU",
    };
    service.setUser(user);
    expect(service.currentUser()).toEqual(user);
  });

  it("setUser() should make isAuthenticated return true", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it("setUser(null) should clear user and set isAuthenticated to false", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    service.setUser(null);
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it("logout() should clear the current user", () => {
    const user: User = {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "member",
      initials: "T",
    };
    service.setUser(user);
    service.logout();
    expect(service.currentUser()).toBeNull();
  });

  it("logout() should navigate to '/'", () => {
    const navigateSpy = vi.spyOn(router, "navigate");
    service.logout();
    expect(navigateSpy).toHaveBeenCalledWith(["/"]);
  });

  it("login() should call supabase.signIn with the given credentials", async () => {
    await service.login("user@example.com", "password123");
    expect(supabaseSpy.signIn).toHaveBeenCalledWith(
      "user@example.com",
      "password123",
    );
  });

  it("login() should return null error on success", async () => {
    supabaseSpy.signIn.mockResolvedValue({ error: null });
    const result = await service.login("user@example.com", "correct");
    expect(result.error).toBeNull();
  });

  it("login() should return an Error instance on failure", async () => {
    supabaseSpy.signIn.mockResolvedValue({
      error: new Error("Invalid credentials"),
    });
    const result = await service.login("user@example.com", "wrong");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Invalid credentials");
  });

  it("resetPasswordForEmail() should call supabase.resetPasswordForEmail", async () => {
    await service.resetPasswordForEmail("user@example.com");
    expect(supabaseSpy.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
    );
  });

  it("whenReady should resolve after getUser() completes", async () => {
    await expect(service.whenReady).resolves.toBeDefined();
  });
});
