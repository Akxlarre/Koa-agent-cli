import { TestBed } from "@angular/core/testing";
import { Component } from "@angular/core";
import { LayoutDrawerFacadeService } from "./layout-drawer.facade.service";
import { LayoutDrawerService } from "./layout-drawer.service";

@Component({ standalone: true, template: "" })
class DummyPanelComponent {}

describe("LayoutDrawerFacadeService", () => {
  let facade: LayoutDrawerFacadeService;
  let drawer: LayoutDrawerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    facade = TestBed.inject(LayoutDrawerFacadeService);
    drawer = TestBed.inject(LayoutDrawerService);
  });

  it("should be created", () => {
    expect(facade).toBeTruthy();
  });

  it("should expose the service state through its own signals", () => {
    drawer.open(DummyPanelComponent, "Detalle", "info");
    expect(facade.isOpen()).toBe(true);
    expect(facade.component()).toBe(DummyPanelComponent);
    expect(facade.title()).toBe("Detalle");
    expect(facade.icon()).toBe("info");
  });

  it("open() should delegate to the service", () => {
    facade.open(DummyPanelComponent, "Detalle");
    expect(drawer.isOpen()).toBe(true);
    expect(drawer.component()).toBe(DummyPanelComponent);
  });

  it("close() should delegate to the service", () => {
    facade.open(DummyPanelComponent, "Detalle");
    facade.close();
    expect(drawer.isOpen()).toBe(false);
  });

  it("setActions() should delegate to the service", () => {
    facade.open(DummyPanelComponent, "Detalle");
    facade.setActions([{ label: "Guardar", icon: "save", callback: () => {} }]);
    expect(drawer.actions()).toHaveLength(1);
  });

  it("should NOT re-expose clear() — that is the drawer component's job", () => {
    // El facade es la superficie que ve la UI. clear() destruye la vista y solo
    // debe llamarlo el componente del drawer cuando GSAP termino la salida.
    // Exponerlo aqui invitaria a un componente cualquiera a matar la animacion.
    expect((facade as unknown as { clear?: unknown }).clear).toBeUndefined();
  });
});
